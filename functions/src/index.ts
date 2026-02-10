import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Lazy-load OpenAI to avoid initialization timeout
let openaiModule: typeof import('openai') | null = null;
async function getOpenAIModule() {
  if (!openaiModule) {
    openaiModule = await import('openai');
  }
  return openaiModule;
}

// Types
interface Judge {
  judgeId: string;
  name: string;
  avatar: string;
  personality: string;
  evaluationStyle: string;
  promptTemplate: string;
}

interface JudgeWeight {
  judgeId: string;
  weight: number;
}

interface Evaluation {
  judgeId: string;
  judgeName: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  rawResponse: Record<string, unknown>;
}

interface SubmissionEvaluation {
  finalScore: number;
  evaluations: Evaluation[];
  conceptsIdentified: string[];
  processedAt: admin.firestore.Timestamp;
}

// Helper function to get OpenAI client (async due to lazy loading)
async function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY secret not configured');
  }
  const { default: OpenAI } = await getOpenAIModule();
  return new OpenAI({ apiKey });
}

// Helper function to evaluate with a single judge
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function evaluateWithJudge(
  openai: any,
  judge: Judge,
  scenario: Record<string, unknown>,
  studentResponse: string,
  sessionConfig: Record<string, unknown>,
  knowledgeBase: string,
  referenceDocs: string
): Promise<Evaluation> {
  let prompt = judge.promptTemplate
    .replace('{{name}}', judge.name)
    .replace('{{personality}}', judge.personality)
    .replace('{{evaluationStyle}}', judge.evaluationStyle)
    .replace('{{knowledgeBase}}', knowledgeBase || 'No knowledge base provided')
    .replace('{{referenceDocs}}', referenceDocs || 'No reference documents provided')
    .replace('{{rubric}}', JSON.stringify(sessionConfig.rubric || {}, null, 2))
    .replace('{{scenario}}', JSON.stringify(scenario, null, 2))
    .replace('{{idealAnswer}}', JSON.stringify(scenario.idealAnswer || {}, null, 2))
    .replace('{{studentResponse}}', studentResponse);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Evalua la respuesta del estudiante y responde SOLO con JSON valido.' }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const response = JSON.parse(responseText);

    return {
      judgeId: judge.judgeId,
      judgeName: judge.name,
      score: response.score || 0,
      feedback: response.feedback || 'Sin retroalimentación',
      strengths: response.strengths || [],
      improvements: response.improvements || [],
      rawResponse: response,
    };
  } catch (error) {
    console.error(`Error with judge ${judge.judgeId}:`, error);
    return {
      judgeId: judge.judgeId,
      judgeName: judge.name,
      score: 50,
      feedback: 'Error en la evaluación. Se asignó puntaje neutral.',
      strengths: [],
      improvements: [],
      rawResponse: { error: String(error) },
    };
  }
}

// =====================================
// EVALUATE SUBMISSION
// =====================================
export const evaluateSubmission = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 120, memory: '512MB', secrets: ['OPENAI_API_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { gameCode, round, submissionId } = data;

    if (!gameCode || round === undefined || !submissionId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    const openai = await getOpenAI();

    try {
      const submissionRef = db.collection('games').doc(gameCode)
        .collection('submissions').doc(submissionId);
      const submissionDoc = await submissionRef.get();

      if (!submissionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Submission not found');
      }

      const submission = submissionDoc.data()!;

      const gameDoc = await db.collection('games').doc(gameCode).get();
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Game not found');
      }

      const game = gameDoc.data()!;
      const { sessionConfig, scenarios } = game;
      const scenario = scenarios[round - 1];

      if (!scenario) {
        throw new functions.https.HttpsError('not-found', 'Scenario not found');
      }

      const judgesDoc = await db.collection('config').doc('judges').get();
      const judgesConfig = judgesDoc.exists ? judgesDoc.data() : null;

      const judgeWeights: JudgeWeight[] = sessionConfig.judges || [
        { judgeId: 'technical_expert', weight: 0.35 },
        { judgeId: 'public_sector', weight: 0.35 },
        { judgeId: 'professor_twin', weight: 0.30 },
      ];

      const evaluationPromises = judgeWeights.map(async (jw) => {
        const judge = judgesConfig?.judges?.find((j: Judge) => j.judgeId === jw.judgeId);
        if (!judge) {
          console.warn(`Judge ${jw.judgeId} not found`);
          return null;
        }
        return evaluateWithJudge(
          openai, judge, scenario, submission.response,
          sessionConfig, game.knowledgeBase || '', game.referenceDocs || ''
        );
      });

      const evaluations = (await Promise.all(evaluationPromises)).filter(Boolean) as Evaluation[];

      let totalWeight = 0;
      let weightedScore = 0;
      const conceptsIdentified: string[] = [];

      evaluations.forEach((evaluation, index) => {
        const weight = judgeWeights[index]?.weight || 0.33;
        weightedScore += evaluation.score * weight;
        totalWeight += weight;
        if (evaluation.rawResponse && Array.isArray((evaluation.rawResponse as Record<string, unknown>).conceptsIdentified)) {
          conceptsIdentified.push(...(evaluation.rawResponse as Record<string, string[]>).conceptsIdentified);
        }
      });

      const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

      const evaluationResult: SubmissionEvaluation = {
        finalScore,
        evaluations,
        conceptsIdentified: [...new Set(conceptsIdentified)],
        processedAt: admin.firestore.Timestamp.now(),
      };

      await submissionRef.update({
        evaluation: evaluationResult,
        evaluated: true,
      });

      return { success: true, finalScore, evaluations };

    } catch (error) {
      console.error('Evaluation error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to evaluate submission');
    }
  });

// =====================================
// PROCESS ROUND END
// =====================================
export const processRoundEnd = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 300, memory: '1GB', secrets: ['OPENAI_API_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { gameCode, round } = data;

    if (!gameCode || round === undefined) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing gameCode or round');
    }

    const openai = await getOpenAI();

    try {
      const submissionsSnapshot = await db.collection('games').doc(gameCode)
        .collection('submissions')
        .where('round', '==', round)
        .get();

      const gameDoc = await db.collection('games').doc(gameCode).get();
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Game not found');
      }
      const game = gameDoc.data()!;
      const { sessionConfig, scenarios } = game;
      const scenario = scenarios[round - 1];

      const judgesDoc = await db.collection('config').doc('judges').get();
      const judgesConfig = judgesDoc.exists ? judgesDoc.data() : null;

      const judgeWeights: JudgeWeight[] = sessionConfig.judges || [
        { judgeId: 'technical_expert', weight: 0.35 },
        { judgeId: 'public_sector', weight: 0.35 },
        { judgeId: 'professor_twin', weight: 0.30 },
      ];

      const unevaluatedDocs = submissionsSnapshot.docs.filter(doc => !doc.data().evaluated);

      for (const doc of unevaluatedDocs) {
        const submission = doc.data();

        const evaluationPromises = judgeWeights.map(async (jw) => {
          const judge = judgesConfig?.judges?.find((j: Judge) => j.judgeId === jw.judgeId);
          if (!judge) return null;
          return evaluateWithJudge(
            openai, judge, scenario, submission.response,
            sessionConfig, game.knowledgeBase || '', game.referenceDocs || ''
          );
        });

        const evaluations = (await Promise.all(evaluationPromises)).filter(Boolean) as Evaluation[];

        let totalWeight = 0;
        let weightedScore = 0;
        const conceptsIdentified: string[] = [];

        evaluations.forEach((evaluation, index) => {
          const weight = judgeWeights[index]?.weight || 0.33;
          weightedScore += evaluation.score * weight;
          totalWeight += weight;
          if (evaluation.rawResponse && Array.isArray((evaluation.rawResponse as Record<string, unknown>).conceptsIdentified)) {
            conceptsIdentified.push(...(evaluation.rawResponse as Record<string, string[]>).conceptsIdentified);
          }
        });

        const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;

        await doc.ref.update({
          evaluation: {
            finalScore,
            evaluations,
            conceptsIdentified: [...new Set(conceptsIdentified)],
            processedAt: admin.firestore.Timestamp.now(),
          },
          evaluated: true,
        });
      }

      const scores: { playerId: string; playerName: string; score: number }[] = [];

      const evaluatedSnapshot = await db.collection('games').doc(gameCode)
        .collection('submissions')
        .where('round', '==', round)
        .get();

      evaluatedSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.evaluation) {
          scores.push({
            playerId: data.playerId,
            playerName: data.playerName,
            score: data.evaluation.finalScore,
          });
        }
      });

      scores.sort((a, b) => b.score - a.score);

      let currentRank = 1;
      const rankings = scores.map((s, index) => {
        if (index > 0 && s.score < scores[index - 1].score) {
          currentRank = index + 1;
        }
        return { ...s, rank: currentRank };
      });

      await db.collection('games').doc(gameCode)
        .collection('rounds').doc(`round_${round}`).set({
          round,
          rankings,
          processedAt: admin.firestore.Timestamp.now(),
        });

      // Update player totalScores in the game document
      const playerUpdates: Record<string, number> = {};
      for (const score of scores) {
        const currentPlayer = game.players?.[score.playerId];
        const currentTotal = currentPlayer?.totalScore || 0;
        playerUpdates[`players.${score.playerId}.totalScore`] = currentTotal + score.score;
      }

      if (Object.keys(playerUpdates).length > 0) {
        await db.collection('games').doc(gameCode).update(playerUpdates);
      }

      return { success: true, rankings };

    } catch (error) {
      console.error('Process round error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to process round');
    }
  });

// =====================================
// GENERATE STUDENT REPORT
// =====================================
export const generateStudentReport = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { gameCode, playerId } = data;

    if (!gameCode) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing gameCode');
    }

    const targetPlayerId = playerId || context.auth.uid;

    try {
      const gameDoc = await db.collection('games').doc(gameCode).get();
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Game not found');
      }

      const game = gameDoc.data()!;

      const submissionsSnapshot = await db.collection('games').doc(gameCode)
        .collection('submissions')
        .where('playerId', '==', targetPlayerId)
        .orderBy('round')
        .get();

      const roundDetails = submissionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          round: data.round,
          scenario: game.scenarios[data.round - 1]?.title || `Ronda ${data.round}`,
          response: data.response,
          evaluation: data.evaluation,
        };
      });

      const totalScore = roundDetails.reduce((sum, r) => sum + (r.evaluation?.finalScore || 0), 0);
      const avgScore = roundDetails.length > 0 ? Math.round(totalScore / roundDetails.length) : 0;

      const allStrengths: string[] = [];
      const allImprovements: string[] = [];
      const allConcepts: string[] = [];

      roundDetails.forEach(r => {
        if (r.evaluation) {
          r.evaluation.evaluations?.forEach((e: Evaluation) => {
            allStrengths.push(...(e.strengths || []));
            allImprovements.push(...(e.improvements || []));
          });
          allConcepts.push(...(r.evaluation.conceptsIdentified || []));
        }
      });

      return {
        success: true,
        report: {
          gameCode,
          sessionTitle: game.sessionConfig?.title || 'Sesión',
          playerId: targetPlayerId,
          totalRounds: game.scenarios?.length || 0,
          completedRounds: roundDetails.length,
          averageScore: avgScore,
          roundDetails,
          summary: {
            strengths: [...new Set(allStrengths)],
            improvements: [...new Set(allImprovements)],
            conceptsIdentified: [...new Set(allConcepts)],
          },
          generatedAt: admin.firestore.Timestamp.now(),
        },
      };

    } catch (error) {
      console.error('Generate report error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to generate report');
    }
  });

// =====================================
// GENERATE ORAL TASK
// =====================================
export const generateOralTask = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '512MB', secrets: ['OPENAI_API_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { gameCode, playerId } = data;

    if (!gameCode) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing gameCode');
    }

    const targetPlayerId = playerId || context.auth.uid;
    const openai = await getOpenAI();

    try {
      const gameDoc = await db.collection('games').doc(gameCode).get();
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Game not found');
      }

      const submissionsSnapshot = await db.collection('games').doc(gameCode)
        .collection('submissions')
        .where('playerId', '==', targetPlayerId)
        .orderBy('round')
        .get();

      const roundDetails = submissionsSnapshot.docs.map(doc => {
        const data = doc.data();
        return { round: data.round, evaluation: data.evaluation };
      });

      const totalScore = roundDetails.reduce((sum, r) => sum + (r.evaluation?.finalScore || 0), 0);
      const avgScore = roundDetails.length > 0 ? Math.round(totalScore / roundDetails.length) : 0;

      const allImprovements: string[] = [];
      const allConcepts: string[] = [];

      roundDetails.forEach(r => {
        if (r.evaluation) {
          r.evaluation.evaluations?.forEach((e: Evaluation) => {
            allImprovements.push(...(e.improvements || []));
          });
          allConcepts.push(...(r.evaluation.conceptsIdentified || []));
        }
      });

      const weakAreas = [...new Set(allImprovements)].slice(0, 3);
      const conceptsToReinforce = [...new Set(allConcepts)].slice(0, 3);

      const prompt = `
Eres un profesor universitario diseñando una tarea de presentación oral para un estudiante.

PERFIL DEL ESTUDIANTE:
- Puntaje promedio: ${avgScore}/100
- Areas de mejora identificadas: ${weakAreas.join(', ') || 'No especificadas'}
- Conceptos a reforzar: ${conceptsToReinforce.join(', ') || 'No especificados'}
- Contexto: Curso de Machine Learning II para profesionales del sector público chileno

REQUERIMIENTOS DE LA TAREA:
- Duración: 5-7 minutos de presentación
- Debe permitir al estudiante demostrar comprensión de los conceptos débiles
- Debe ser aplicada al contexto del sector público
- Incluir guía de preparación

Genera la tarea en JSON con este formato:
{
  "title": "Título de la presentación",
  "description": "Descripción de lo que debe presentar",
  "focusConcepts": ["concepto1", "concepto2"],
  "requirements": {
    "minDuration": 5,
    "maxDuration": 7,
    "requiredElements": ["elemento1", "elemento2"]
  },
  "preparationGuide": {
    "readings": ["lectura sugerida"],
    "keyQuestions": ["pregunta a responder"],
    "tips": ["consejo de preparación"]
  }
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Genera la tarea de presentación oral personalizada.' }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const taskContent = JSON.parse(completion.choices[0]?.message?.content || '{}');

      return {
        success: true,
        task: {
          ...taskContent,
          studentId: targetPlayerId,
          gameCode,
          basedOnScore: avgScore,
          generatedAt: admin.firestore.Timestamp.now(),
        },
      };

    } catch (error) {
      console.error('Generate oral task error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to generate oral task');
    }
  });

// =====================================
// GENERATE CLASS REPORT (Professor)
// =====================================
export const generateClassReport = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { gameCode } = data;

    if (!gameCode) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing gameCode');
    }

    try {
      // Get game document
      const gameDoc = await db.collection('games').doc(gameCode).get();
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Game not found');
      }

      const game = gameDoc.data()!;

      // Verify user is the host
      if (game.hostId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the host can generate class reports');
      }

      // Get all submissions for this game
      const submissionsSnapshot = await db.collection('games').doc(gameCode)
        .collection('submissions')
        .get();

      // Group submissions by player and round
      const playerData: Record<string, {
        name: string;
        email?: string;
        roundScores: Record<number, number>;
        totalScore: number;
        roundDetails: Array<{
          round: number;
          score: number;
          strengths: string[];
          improvements: string[];
        }>;
      }> = {};

      submissionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const playerId = data.playerId;

        if (!playerData[playerId]) {
          playerData[playerId] = {
            name: data.playerName || 'Anonimo',
            roundScores: {},
            totalScore: 0,
            roundDetails: [],
          };
        }

        const score = data.evaluation?.finalScore || 0;
        playerData[playerId].roundScores[data.round] = score;
        playerData[playerId].totalScore += score;

        // Collect feedback
        const strengths: string[] = [];
        const improvements: string[] = [];
        data.evaluation?.evaluations?.forEach((e: Evaluation) => {
          strengths.push(...(e.strengths || []));
          improvements.push(...(e.improvements || []));
        });

        playerData[playerId].roundDetails.push({
          round: data.round,
          score,
          strengths: [...new Set(strengths)],
          improvements: [...new Set(improvements)],
        });
      });

      // Calculate class statistics
      const players = Object.entries(playerData).map(([playerId, data]) => {
        const roundCount = Object.keys(data.roundScores).length;
        return {
          playerId,
          name: data.name,
          roundScores: data.roundScores,
          totalScore: data.totalScore,
          averageScore: roundCount > 0 ? Math.round(data.totalScore / roundCount) : 0,
          roundDetails: data.roundDetails.sort((a, b) => a.round - b.round),
        };
      });

      // Sort by average score descending
      players.sort((a, b) => b.averageScore - a.averageScore);

      // Assign ranks
      let currentRank = 1;
      const rankedPlayers = players.map((player, index) => {
        if (index > 0 && player.averageScore < players[index - 1].averageScore) {
          currentRank = index + 1;
        }
        return { ...player, rank: currentRank };
      });

      // Calculate class-level stats
      const allScores = players.map(p => p.averageScore);
      const classAverage = allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0;

      // Score distribution
      const distribution = {
        excellent: players.filter(p => p.averageScore >= 90).length,
        good: players.filter(p => p.averageScore >= 75 && p.averageScore < 90).length,
        average: players.filter(p => p.averageScore >= 60 && p.averageScore < 75).length,
        needsWork: players.filter(p => p.averageScore < 60).length,
      };

      // Per-round class averages
      const roundAverages: Record<number, number> = {};
      for (let r = 1; r <= game.totalRounds; r++) {
        const roundScores = players
          .map(p => p.roundScores[r])
          .filter(s => s !== undefined);
        if (roundScores.length > 0) {
          roundAverages[r] = Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length);
        }
      }

      // Collect all improvement areas (most common)
      const allImprovements: Record<string, number> = {};
      players.forEach(p => {
        p.roundDetails.forEach(rd => {
          rd.improvements.forEach(imp => {
            allImprovements[imp] = (allImprovements[imp] || 0) + 1;
          });
        });
      });
      const topImprovementAreas = Object.entries(allImprovements)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([area, count]) => ({ area, count }));

      return {
        success: true,
        report: {
          gameCode,
          sessionTitle: game.sessionConfig?.title || 'Sesion',
          totalRounds: game.totalRounds,
          totalPlayers: players.length,
          classAverage,
          distribution,
          roundAverages,
          topImprovementAreas,
          players: rankedPlayers,
          scenarios: game.scenarios?.map((s: Record<string, unknown>, i: number) => ({
            round: i + 1,
            title: s.title,
            category: s.category,
          })) || [],
          generatedAt: admin.firestore.Timestamp.now(),
        },
      };

    } catch (error) {
      console.error('Generate class report error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to generate class report');
    }
  });

// =====================================
// SEED JUDGES (One-time initialization)
// =====================================
export const seedJudges = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    try {
      // Check if judges already exist
      const judgesDoc = await db.collection('config').doc('judges').get();
      if (judgesDoc.exists) {
        res.json({ success: true, message: 'Judges already configured', exists: true });
        return;
      }

      // Default judges configuration
      const defaultJudges = {
        judges: [
          {
            judgeId: 'technical_expert',
            name: 'Dr. Tech',
            avatar: '🔬',
            personality: 'Eres un experto en Machine Learning y sistemas de IA con 15 anos de experiencia en investigacion y desarrollo. Has trabajado en Google DeepMind y OpenAI antes de dedicarte a la consultoria para gobiernos. Eres riguroso con la precision tecnica pero entiendes que los estudiantes son profesionales de gobierno, no ingenieros de ML.',
            evaluationStyle: 'Evaluas principalmente la precision tecnica. Te fijas en: uso correcto de terminologia, comprension de conceptos fundamentales (transformers, tokenizacion, embeddings), y ausencia de errores conceptuales. Valoras cuando alguien admite no saber algo vs. inventar. Penalizas fuertemente las afirmaciones tecnicas incorrectas.',
            focusDimensions: ['technical_accuracy'],
            promptTemplate: 'Eres {{name}}, un evaluador tecnico experto.\n\n{{personality}}\n\nESTILO DE EVALUACION:\n{{evaluationStyle}}\n\nMATERIAL DE REFERENCIA DEL CURSO:\n{{knowledgeBase}}\n\nDOCUMENTOS DE REFERENCIA:\n{{referenceDocs}}\n\nRUBRICA DE EVALUACION:\n{{rubric}}\n\nESCENARIO:\n{{scenario}}\n\nRESPUESTA IDEAL (para calibracion, no revelar al estudiante):\n{{idealAnswer}}\n\nRESPUESTA DEL ESTUDIANTE:\n{{studentResponse}}\n\nEvalua la respuesta del estudiante. Debes responder en JSON con el siguiente formato:\n{\n  "score": <numero 0-100>,\n  "feedback": "<retroalimentacion constructiva en espanol, 2-3 oraciones>",\n  "strengths": ["<fortaleza 1>", "<fortaleza 2>"],\n  "improvements": ["<area de mejora 1>", "<area de mejora 2>"],\n  "conceptsIdentified": ["<concepto mencionado correctamente>"],\n  "conceptsMissing": ["<concepto importante que falto>"],\n  "technicalErrors": ["<error tecnico si hubo>"]\n}'
          },
          {
            judgeId: 'public_sector',
            name: 'Ministra Digital',
            avatar: '🏛️',
            personality: 'Eres una ex-Subsecretaria de Gobierno Digital de Chile con experiencia en implementacion de tecnologia en el sector publico. Conoces las restricciones reales: presupuestos limitados, equipos tecnicos pequenos, resistencia al cambio, y la necesidad de transparencia y auditabilidad. Has visto proyectos de IA fracasar por no considerar el contexto.',
            evaluationStyle: 'Evaluas principalmente la aplicabilidad practica. Te fijas en: consideracion de restricciones reales (presupuesto, tiempo, capacidades), viabilidad de implementacion, consideracion de privacidad ciudadana, y pensamiento sobre escalabilidad y mantenimiento. Valoras soluciones pragmaticas sobre soluciones perfectas pero inviables.',
            focusDimensions: ['practical_application'],
            promptTemplate: 'Eres {{name}}, una evaluadora experta en transformacion digital del sector publico.\n\n{{personality}}\n\nESTILO DE EVALUACION:\n{{evaluationStyle}}\n\nMATERIAL DE REFERENCIA DEL CURSO:\n{{knowledgeBase}}\n\nDOCUMENTOS DE REFERENCIA:\n{{referenceDocs}}\n\nRUBRICA DE EVALUACION:\n{{rubric}}\n\nESCENARIO:\n{{scenario}}\n\nRESPUESTA IDEAL (para calibracion, no revelar al estudiante):\n{{idealAnswer}}\n\nRESPUESTA DEL ESTUDIANTE:\n{{studentResponse}}\n\nEvalua la respuesta del estudiante desde la perspectiva de implementacion en sector publico chileno. Debes responder en JSON con el siguiente formato:\n{\n  "score": <numero 0-100>,\n  "feedback": "<retroalimentacion constructiva en espanol, 2-3 oraciones>",\n  "strengths": ["<fortaleza 1>", "<fortaleza 2>"],\n  "improvements": ["<area de mejora 1>", "<area de mejora 2>"],\n  "practicalConsiderations": ["<aspecto practico bien considerado>"],\n  "missedConstraints": ["<restriccion importante que no considero>"],\n  "implementationViability": "<alta|media|baja con justificacion breve>"\n}'
          },
          {
            judgeId: 'professor_twin',
            name: 'Profe Naim',
            avatar: '👨‍🏫',
            personality: 'Eres el gemelo digital del profesor del curso. Conoces exactamente lo que se enseno en clase, las lecturas asignadas, y lo que esperas que los estudiantes hayan aprendido. Eres exigente pero justo, y valoras especialmente el pensamiento critico y la capacidad de sintesis. Te frustra cuando los estudiantes repiten sin entender o cuando no aplican lo aprendido.',
            evaluationStyle: 'Evaluas el pensamiento critico y la sintesis de conceptos. Te fijas en: analisis de trade-offs, consideracion de alternativas, justificacion de decisiones, y demostracion de comprension profunda (no solo memorizacion). Valoras cuando alguien va mas alla de lo pedido con insights propios. Penalizas respuestas superficiales o que solo repiten definiciones sin aplicarlas.',
            focusDimensions: ['critical_thinking'],
            promptTemplate: 'Eres {{name}}, el profesor del curso Machine Learning II.\n\n{{personality}}\n\nESTILO DE EVALUACION:\n{{evaluationStyle}}\n\nMATERIAL DE REFERENCIA DEL CURSO (esto es lo que ensenaste):\n{{knowledgeBase}}\n\nDOCUMENTOS DE REFERENCIA (lecturas asignadas):\n{{referenceDocs}}\n\nRUBRICA DE EVALUACION:\n{{rubric}}\n\nESCENARIO:\n{{scenario}}\n\nRESPUESTA IDEAL (lo que esperabas):\n{{idealAnswer}}\n\nRESPUESTA DEL ESTUDIANTE:\n{{studentResponse}}\n\nEvalua la respuesta del estudiante como su profesor. Se exigente pero constructivo. Debes responder en JSON con el siguiente formato:\n{\n  "score": <numero 0-100>,\n  "feedback": "<retroalimentacion como profesor, 2-3 oraciones, puede ser directo>",\n  "strengths": ["<fortaleza 1>", "<fortaleza 2>"],\n  "improvements": ["<area de mejora 1>", "<area de mejora 2>"],\n  "criticalThinking": "<evaluacion del pensamiento critico demostrado>",\n  "synthesisLevel": "<excelente|bueno|basico|insuficiente>",\n  "wouldDiscussInClass": <true|false>,\n  "additionalComments": "<comentario adicional opcional>"\n}'
          }
        ],
        defaultWeights: {
          technical_expert: 0.35,
          public_sector: 0.35,
          professor_twin: 0.30
        },
        evaluationSettings: {
          model: 'gpt-4o',
          temperature: 0.3,
          maxTokens: 1000,
          parallelEvaluation: true
        }
      };

      await db.collection('config').doc('judges').set(defaultJudges);
      res.json({ success: true, message: 'Judges configuration seeded successfully' });

    } catch (error) {
      console.error('Seed judges error:', error);
      res.status(500).json({ success: false, error: 'Failed to seed judges' });
    }
  });
