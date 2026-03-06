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
  parsedSignals?: Record<string, unknown>;
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
  referenceDocs: string,
  isRanked: boolean = true
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

  // For non-ranked rounds, add signal extraction instructions
  if (!isRanked) {
    const scenarioId = (scenario as Record<string, unknown>).id as string || '';
    const isFeria = scenarioId.includes('feria');
    const isEstilo = scenarioId.includes('estilo');

    if (isFeria) {
      // R4 "Feria Comprimida": implicit signal extraction from structured free text
      prompt += `\n\nINSTRUCCIONES ADICIONALES PARA RONDA DIAGNOSTICA (FERIA):
Esta ronda NO afecta el ranking. Evalua normalmente, pero ademas extrae senales IMPLICITAS del texto del estudiante.
Debes inferir del contenido de la respuesta los siguientes campos:
- "family_chosen": numero de la familia que eligio (1-6)
- "decision_clarity": 1-5, que tan concreta es la decision que describe
- "boundary_quality": 1-5, que tan bien define lo que el sistema NO debe hacer
- "metric_quality": 1-5, que tan concreta y medible es la metrica propuesta
- "output_preference": "reporte" / "chatbot" / "ambos" (si lo indica)
- "writing_concision": 1-5, claridad y economia del lenguaje
Incluye en tu JSON de respuesta un campo "parsedSignals" con estos valores y "extractionConfidence" entre 0.3 y 1.0.
Manten tu feedback conciso (max 120 palabras).`;
    } else if (isEstilo) {
      // R6 "Estilo de trabajo": semi-structured extraction from labeled fields
      prompt += `\n\nINSTRUCCIONES ADICIONALES PARA RONDA DIAGNOSTICA (ESTILO):
Esta ronda NO afecta el ranking. Evalua normalmente, pero ademas extrae senales del texto del estudiante.
Busca estos campos en la respuesta (pueden estar etiquetados o en texto libre):
- "primary_strength": su fortaleza principal (texto breve)
- "work_style": "autonomo" / "colaborativo" / "mixto"
- "conflict_style": "decidir_rapido" / "buscar_consenso" / "pedir_evidencia"
- "ventana_reunion": "manana" / "almuerzo" / "tarde" / "noche" / "finde"
- "redes_acceso": texto libre indicando si tiene contactos y donde, o "no"
- "learning_goal": que quiere aprender (texto breve)
Incluye en tu JSON de respuesta un campo "parsedSignals" con estos valores y "extractionConfidence" entre 0.3 y 1.0.
Manten tu feedback conciso (max 120 palabras).`;
    } else {
      // R5: explicit [SENALES] block extraction
      prompt += `\n\nINSTRUCCIONES ADICIONALES PARA RONDA DIAGNOSTICA:
Esta ronda NO afecta el ranking. Ademas de evaluar normalmente, debes extraer senales del estudiante.
Si la respuesta contiene un bloque [SENALES]...[/SENALES], parsea los valores estructurados dentro de ese bloque.
Campos esperados: PREFERENCIAS_FAMILIAS (3 numeros 1-6), SKILL_TECH/SKILL_DATOS/SKILL_SECTOR_PUBLICO/SKILL_ESCRITURA_PRESENTAR (1-5 cada uno), ROL_PREFERIDO (builder/owner/analyst/communicator), DISPONIBILIDAD_HORAS_SEMANA (numero), OUTPUT_PREFERIDO (reporte/chatbot/ambos).
Incluye en tu JSON de respuesta un campo adicional "parsedSignals" con los valores extraidos como objeto.
Si el bloque [SENALES] no existe o esta malformado, incluye "parsedSignals": null y agrega "extractionConfidence": 0.
Si el bloque existe y se parseo correctamente, agrega "extractionConfidence" entre 0.5 y 1.0 segun la calidad del parseo.
Manten tu respuesta concisa (max 120 palabras de feedback + bloque de senales).`;
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Evalua la respuesta del estudiante y responde SOLO con JSON valido.' }
      ],
      temperature: 0.3,
      max_tokens: isRanked ? 1000 : 1500,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    const response = JSON.parse(responseText);

    const evaluation: Evaluation = {
      judgeId: judge.judgeId,
      judgeName: judge.name,
      score: response.score || 0,
      feedback: response.feedback || 'Sin retroalimentacion',
      strengths: response.strengths || [],
      improvements: response.improvements || [],
      rawResponse: response,
    };

    // Extract parsed signals for non-ranked rounds
    if (!isRanked && response.parsedSignals) {
      evaluation.parsedSignals = { ...response.parsedSignals };
      if (response.extractionConfidence !== undefined) {
        evaluation.parsedSignals!.extractionConfidence = response.extractionConfidence;
      }
    }

    return evaluation;
  } catch (error) {
    console.error(`Error with judge ${judge.judgeId}:`, error);
    return {
      judgeId: judge.judgeId,
      judgeName: judge.name,
      score: 50,
      feedback: 'Error en la evaluacion. Se asigno puntaje neutral.',
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

      const isRanked = scenario.ranked !== false;

      const evaluationPromises = judgeWeights.map(async (jw) => {
        const judge = judgesConfig?.judges?.find((j: Judge) => j.judgeId === jw.judgeId);
        if (!judge) {
          console.warn(`Judge ${jw.judgeId} not found`);
          return null;
        }
        return evaluateWithJudge(
          openai, judge, scenario, submission.response,
          sessionConfig, game.knowledgeBase || '', game.referenceDocs || '',
          isRanked
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

      const isRanked = scenario.ranked !== false;
      const unevaluatedDocs = submissionsSnapshot.docs.filter(doc => !doc.data().evaluated);

      for (const doc of unevaluatedDocs) {
        const submission = doc.data();

        const evaluationPromises = judgeWeights.map(async (jw) => {
          const judge = judgesConfig?.judges?.find((j: Judge) => j.judgeId === jw.judgeId);
          if (!judge) return null;
          return evaluateWithJudge(
            openai, judge, scenario, submission.response,
            sessionConfig, game.knowledgeBase || '', game.referenceDocs || '',
            isRanked
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
          ranked: isRanked,
          rankings,
          processedAt: admin.firestore.Timestamp.now(),
        });

      // Only update player totalScores for ranked rounds
      if (isRanked) {
        const playerUpdates: Record<string, number> = {};
        for (const score of scores) {
          const currentPlayer = game.players?.[score.playerId];
          const currentTotal = currentPlayer?.totalScore || 0;
          playerUpdates[`players.${score.playerId}.totalScore`] = currentTotal + score.score;
        }

        if (Object.keys(playerUpdates).length > 0) {
          await db.collection('games').doc(gameCode).update(playerUpdates);
        }
      }

      return { success: true, rankings, ranked: isRanked };

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
        const scenarioData = game.scenarios[data.round - 1];
        return {
          round: data.round,
          ranked: scenarioData?.ranked !== false,
          scenario: scenarioData?.title || `Ronda ${data.round}`,
          response: data.response,
          evaluation: data.evaluation,
        };
      });

      // Only sum ranked round scores for totalScore/averageScore
      const rankedRounds = roundDetails.filter(r => r.ranked);
      const totalScore = rankedRounds.reduce((sum, r) => sum + (r.evaluation?.finalScore || 0), 0);
      const avgScore = rankedRounds.length > 0 ? Math.round(totalScore / rankedRounds.length) : 0;

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
          ranked: boolean;
          strengths: string[];
          improvements: string[];
        }>;
      }> = {};

      submissionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const playerId = data.playerId;
        const scenarioData = game.scenarios?.[data.round - 1];
        const isRoundRanked = scenarioData?.ranked !== false;

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
        // Only sum ranked round scores
        if (isRoundRanked) {
          playerData[playerId].totalScore += score;
        }

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
          ranked: isRoundRanked,
          strengths: [...new Set(strengths)],
          improvements: [...new Set(improvements)],
        });
      });

      // Calculate class statistics (only ranked rounds for averages)
      const players = Object.entries(playerData).map(([playerId, data]) => {
        const rankedRoundCount = data.roundDetails.filter(r => r.ranked).length;
        return {
          playerId,
          name: data.name,
          roundScores: data.roundScores,
          totalScore: data.totalScore,
          averageScore: rankedRoundCount > 0 ? Math.round(data.totalScore / rankedRoundCount) : 0,
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
// EXPORT SIGNALS SUMMARY (Professor)
// =====================================
export const exportSignalsSummary = functions
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
      const gameDoc = await db.collection('games').doc(gameCode).get();
      if (!gameDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Game not found');
      }

      const game = gameDoc.data()!;

      // Verify user is the host
      if (game.hostId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the host can export signals');
      }

      const submissionsSnapshot = await db.collection('games').doc(gameCode)
        .collection('submissions')
        .get();

      // Build scenario info
      const scenarioInfo = (game.scenarios || []).map((s: Record<string, unknown>, i: number) => ({
        round: i + 1,
        id: s.id,
        title: s.title,
        ranked: s.ranked !== false,
      }));

      // Group by student
      const studentData: Record<string, {
        name: string;
        hardSignals: Record<string, { finalScore: number; judgeScores: Record<string, number> }>;
        softSignals: Record<string, Record<string, unknown>>;
      }> = {};

      submissionsSnapshot.docs.forEach(doc => {
        const sub = doc.data();
        const playerId = sub.playerId;
        const roundIdx = sub.round - 1;
        const scenarioData = game.scenarios?.[roundIdx];
        const isRoundRanked = scenarioData?.ranked !== false;

        if (!studentData[playerId]) {
          studentData[playerId] = {
            name: sub.playerName || 'Anonimo',
            hardSignals: {},
            softSignals: {},
          };
        }

        const roundKey = `round_${sub.round}`;

        if (isRoundRanked) {
          // Hard signals: ranked round scores
          const judgeScores: Record<string, number> = {};
          sub.evaluation?.evaluations?.forEach((e: Evaluation) => {
            judgeScores[e.judgeId] = e.score;
          });
          studentData[playerId].hardSignals[roundKey] = {
            finalScore: sub.evaluation?.finalScore || 0,
            judgeScores,
          };
        } else {
          // Soft signals: merge parsedSignals from evaluations
          const merged: Record<string, unknown> = {};
          sub.evaluation?.evaluations?.forEach((e: Evaluation) => {
            if (e.parsedSignals) {
              Object.assign(merged, e.parsedSignals);
            }
          });
          studentData[playerId].softSignals[roundKey] = merged;
        }
      });

      // Build per-scenario aggregates
      const scenarioSummary: Record<string, Record<string, unknown>> = {};
      for (const scenario of scenarioInfo) {
        if (!scenario.ranked) {
          const roundKey = `round_${scenario.round}`;
          const allInterests: number[] = [];
          const roles: Record<string, number> = {};
          let n = 0;

          Object.values(studentData).forEach(student => {
            const signals = student.softSignals[roundKey];
            if (signals) {
              n++;
              // Collect interest values
              const interest = signals.interestByScenario as Record<string, number> | undefined;
              if (interest) {
                Object.values(interest).forEach(v => {
                  if (typeof v === 'number') allInterests.push(v);
                });
              }
              // Collect roles
              const role = signals.preferredRole as string | undefined;
              if (role) {
                roles[role] = (roles[role] || 0) + 1;
              }
            }
          });

          scenarioSummary[roundKey] = {
            n,
            avg_interest: allInterests.length > 0
              ? Math.round((allInterests.reduce((a, b) => a + b, 0) / allInterests.length) * 10) / 10
              : null,
            share_ge4: allInterests.length > 0
              ? Math.round((allInterests.filter(v => v >= 4).length / allInterests.length) * 100) / 100
              : null,
            roles_distribution: roles,
          };
        }
      }

      const students = Object.entries(studentData).map(([playerId, data]) => ({
        playerId,
        name: data.name,
        hardSignals: data.hardSignals,
        softSignals: data.softSignals,
      }));

      return {
        success: true,
        export: {
          gameCode,
          sessionTitle: game.sessionConfig?.title || 'Sesion',
          exportedAt: admin.firestore.Timestamp.now(),
          scenarioInfo,
          scenarioSummary,
          students,
        },
      };

    } catch (error) {
      console.error('Export signals error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to export signals summary');
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
      // Check if judges already exist (skip with ?force=true)
      const force = req.query.force === 'true';
      const judgesDoc = await db.collection('config').doc('judges').get();
      if (judgesDoc.exists && !force) {
        res.json({ success: true, message: 'Judges already configured. Use ?force=true to overwrite.', exists: true });
        return;
      }

      // Shared rubric scoring instructions injected into every judge prompt
      const rubricInstructions = `
COMO USAR LA RUBRICA:
1. Lee el campo "judgeFocus" del escenario — es tu PRIORIDAD para esta ronda.
2. Evalua la respuesta en CADA dimension de la rubrica (ver "dimensions" abajo).
3. Para cada dimension, identifica en que nivel cae (100/80/60/40/20) usando los descriptores level_100...level_20.
4. Revisa "globalPenalties" — si alguna aplica, el puntaje en esa dimension NO puede superar el techo indicado.
5. Calcula tu score final como promedio ponderado de las 3 dimensiones (pesos en la rubrica).
6. En tu feedback, MENCIONA por nombre la dimension mas debil y el nivel en que cayo.
7. NO repitas la pregunta. NO des feedback generico. Se ESPECIFICO sobre que falta o que esta mal.`;

      const defaultJudges = {
        judges: [
          {
            judgeId: 'technical_expert',
            name: 'Dr. Tech',
            avatar: '🔬',
            personality: 'Eres un ingeniero de sistemas de IA con 15 anos de experiencia. Has construido pipelines de datos en Google y consultado para gobiernos. Eres preciso, clinico, y te fijas en los detalles que otros ignoran. No te impresionan las buenas intenciones — te importa si la respuesta es operacionalmente correcta.',
            evaluationStyle: 'Tu lente principal: Estructuracion de Proceso y Decision (peso alto) + Precision y Claridad (peso alto). Te fijas en: son los insumos realmente fuentes de datos o solo canales? Es la decision binaria/seleccion o es vaga? Es la metrica realmente medible con un numero? Penalizas cuando alguien dice "mejorar la gestion" sin especificar que proceso exacto se mejora.',
            focusDimensions: ['process_structuring', 'precision_clarity'],
            promptTemplate: `Eres {{name}}, evaluador tecnico experto.

{{personality}}

TU LENTE DE EVALUACION:
{{evaluationStyle}}
${rubricInstructions}

MATERIAL DE REFERENCIA DEL CURSO:
{{knowledgeBase}}

DOCUMENTOS DE REFERENCIA:
{{referenceDocs}}

RUBRICA DE EVALUACION:
{{rubric}}

ESCENARIO (incluye "judgeFocus" con la prioridad de esta ronda):
{{scenario}}

RESPUESTA IDEAL (para calibracion, NO revelar al estudiante):
{{idealAnswer}}

RESPUESTA DEL ESTUDIANTE:
{{studentResponse}}

Evalua desde tu lente tecnica. En "feedback", menciona la dimension mas debil y por que. Se especifico — senala que dato falta, que termino es vago, que campo no es operacional.

Responde SOLO con JSON valido:
{
  "score": <0-100, promedio ponderado de dimensiones>,
  "dimensionScores": {
    "process_structuring": <0-100>,
    "institutional_realism": <0-100>,
    "precision_clarity": <0-100>
  },
  "feedback": "<2-3 oraciones especificas, menciona dimension mas debil por nombre>",
  "strengths": ["<fortaleza concreta>"],
  "improvements": ["<mejora concreta y accionable>"],
  "penaltiesApplied": ["<penalidad aplicada, o vacio si ninguna>"],
  "conceptsIdentified": ["<concepto correctamente usado>"]
}`
          },
          {
            judgeId: 'public_sector',
            name: 'Ministra Digital',
            avatar: '🏛️',
            personality: 'Eres una ex-Subsecretaria de Gobierno Digital de Chile. Has implementado y visto fracasar proyectos de tecnologia en el Estado. Conoces las restricciones reales: presupuestos rigidos, equipos chicos, rotacion de autoridades, resistencia de funcionarios, y la obligacion de transparencia. No toleras respuestas que ignoren donde se va a implementar esto.',
            evaluationStyle: 'Tu lente principal: Realismo Institucional (peso alto). Te preguntas: esta persona ha pensado en QUIEN va a usar esto? Que pasa si cambia el alcalde? Donde estan los datos HOY? Hay riesgo de dano ciudadano? Valoras cuando alguien identifica restricciones reales. Penalizas cuando alguien asume que la tecnologia se implementa sola.',
            focusDimensions: ['institutional_realism'],
            promptTemplate: `Eres {{name}}, evaluadora experta en transformacion digital del sector publico chileno.

{{personality}}

TU LENTE DE EVALUACION:
{{evaluationStyle}}
${rubricInstructions}

MATERIAL DE REFERENCIA DEL CURSO:
{{knowledgeBase}}

DOCUMENTOS DE REFERENCIA:
{{referenceDocs}}

RUBRICA DE EVALUACION:
{{rubric}}

ESCENARIO (incluye "judgeFocus" con la prioridad de esta ronda):
{{scenario}}

RESPUESTA IDEAL (para calibracion, NO revelar al estudiante):
{{idealAnswer}}

RESPUESTA DEL ESTUDIANTE:
{{studentResponse}}

Evalua desde tu experiencia en sector publico. En "feedback", senala que restriccion institucional ignoro el estudiante o que riesgo no considero. Se concreta — nombra la restriccion, el riesgo, o el actor que falta.

Responde SOLO con JSON valido:
{
  "score": <0-100, promedio ponderado de dimensiones>,
  "dimensionScores": {
    "process_structuring": <0-100>,
    "institutional_realism": <0-100>,
    "precision_clarity": <0-100>
  },
  "feedback": "<2-3 oraciones desde perspectiva institucional, menciona dimension mas debil>",
  "strengths": ["<fortaleza concreta>"],
  "improvements": ["<restriccion o riesgo concreto que ignoro>"],
  "penaltiesApplied": ["<penalidad aplicada, o vacio si ninguna>"],
  "missedConstraints": ["<restriccion institucional no considerada>"]
}`
          },
          {
            judgeId: 'professor_twin',
            name: 'Profe Naim',
            avatar: '👨‍🏫',
            personality: 'Eres el profesor del curso. Eres directo, exigente, y no te gustan las respuestas que "suenan bien" pero no dicen nada. Te frustra cuando un estudiante llena espacio con generalidades en vez de pensar. Valoras la honestidad intelectual: preferir "no se" a inventar. Pero tambien premias cuando alguien va mas alla de lo pedido con un insight propio.',
            evaluationStyle: 'Tu lente principal: anti-solutionism + sintesis + medicion. Te preguntas: esta persona PENSO o solo lleno los campos? Hay evidencia de comprension profunda o es relleno? Si le preguntara "por que elegiste esa metrica?", tendria una buena respuesta? Penalizas respuestas que podrian aplicar a cualquier problema. Premias insights que muestran experiencia real.',
            focusDimensions: ['critical_thinking', 'synthesis'],
            promptTemplate: `Eres {{name}}, el profesor del curso Machine Learning II.

{{personality}}

TU LENTE DE EVALUACION:
{{evaluationStyle}}
${rubricInstructions}

MATERIAL DE REFERENCIA DEL CURSO (esto es lo que ensenaste):
{{knowledgeBase}}

DOCUMENTOS DE REFERENCIA (lecturas asignadas):
{{referenceDocs}}

RUBRICA DE EVALUACION:
{{rubric}}

ESCENARIO (incluye "judgeFocus" con la prioridad de esta ronda):
{{scenario}}

RESPUESTA IDEAL (lo que esperabas):
{{idealAnswer}}

RESPUESTA DEL ESTUDIANTE:
{{studentResponse}}

Evalua como profesor. Se directo. Si la respuesta es generica, dilo. Si es buena, reconocelo sin exagerar. En "feedback", di que harias distinto si fueras el estudiante. Menciona la dimension mas debil.

Responde SOLO con JSON valido:
{
  "score": <0-100, promedio ponderado de dimensiones>,
  "dimensionScores": {
    "process_structuring": <0-100>,
    "institutional_realism": <0-100>,
    "precision_clarity": <0-100>
  },
  "feedback": "<2-3 oraciones directas como profesor, menciona que harias distinto>",
  "strengths": ["<fortaleza concreta>"],
  "improvements": ["<que debio hacer distinto, especifico>"],
  "penaltiesApplied": ["<penalidad aplicada, o vacio si ninguna>"],
  "wouldDiscussInClass": <true|false>
}`
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
          maxTokens: 1200,
          parallelEvaluation: true
        }
      };

      await db.collection('config').doc('judges').set(defaultJudges);
      res.json({ success: true, message: force ? 'Judges configuration updated' : 'Judges configuration seeded successfully' });

    } catch (error) {
      console.error('Seed judges error:', error);
      res.status(500).json({ success: false, error: 'Failed to seed judges' });
    }
  });
