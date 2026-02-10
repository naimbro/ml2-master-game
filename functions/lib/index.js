"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedJudges = exports.generateOralTask = exports.generateStudentReport = exports.processRoundEnd = exports.evaluateSubmission = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
// Lazy-load OpenAI to avoid initialization timeout
let openaiModule = null;
async function getOpenAIModule() {
    if (!openaiModule) {
        openaiModule = await Promise.resolve().then(() => __importStar(require('openai')));
    }
    return openaiModule;
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
async function evaluateWithJudge(openai, judge, scenario, studentResponse, sessionConfig, knowledgeBase, referenceDocs) {
    var _a, _b;
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
        const responseText = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '{}';
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
    }
    catch (error) {
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
exports.evaluateSubmission = functions
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
        const submission = submissionDoc.data();
        const gameDoc = await db.collection('games').doc(gameCode).get();
        if (!gameDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Game not found');
        }
        const game = gameDoc.data();
        const { sessionConfig, scenarios } = game;
        const scenario = scenarios[round - 1];
        if (!scenario) {
            throw new functions.https.HttpsError('not-found', 'Scenario not found');
        }
        const judgesDoc = await db.collection('config').doc('judges').get();
        const judgesConfig = judgesDoc.exists ? judgesDoc.data() : null;
        const judgeWeights = sessionConfig.judges || [
            { judgeId: 'technical_expert', weight: 0.35 },
            { judgeId: 'public_sector', weight: 0.35 },
            { judgeId: 'professor_twin', weight: 0.30 },
        ];
        const evaluationPromises = judgeWeights.map(async (jw) => {
            var _a;
            const judge = (_a = judgesConfig === null || judgesConfig === void 0 ? void 0 : judgesConfig.judges) === null || _a === void 0 ? void 0 : _a.find((j) => j.judgeId === jw.judgeId);
            if (!judge) {
                console.warn(`Judge ${jw.judgeId} not found`);
                return null;
            }
            return evaluateWithJudge(openai, judge, scenario, submission.response, sessionConfig, game.knowledgeBase || '', game.referenceDocs || '');
        });
        const evaluations = (await Promise.all(evaluationPromises)).filter(Boolean);
        let totalWeight = 0;
        let weightedScore = 0;
        const conceptsIdentified = [];
        evaluations.forEach((evaluation, index) => {
            var _a;
            const weight = ((_a = judgeWeights[index]) === null || _a === void 0 ? void 0 : _a.weight) || 0.33;
            weightedScore += evaluation.score * weight;
            totalWeight += weight;
            if (evaluation.rawResponse && Array.isArray(evaluation.rawResponse.conceptsIdentified)) {
                conceptsIdentified.push(...evaluation.rawResponse.conceptsIdentified);
            }
        });
        const finalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
        const evaluationResult = {
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
    }
    catch (error) {
        console.error('Evaluation error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to evaluate submission');
    }
});
// =====================================
// PROCESS ROUND END
// =====================================
exports.processRoundEnd = functions
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
        const game = gameDoc.data();
        const { sessionConfig, scenarios } = game;
        const scenario = scenarios[round - 1];
        const judgesDoc = await db.collection('config').doc('judges').get();
        const judgesConfig = judgesDoc.exists ? judgesDoc.data() : null;
        const judgeWeights = sessionConfig.judges || [
            { judgeId: 'technical_expert', weight: 0.35 },
            { judgeId: 'public_sector', weight: 0.35 },
            { judgeId: 'professor_twin', weight: 0.30 },
        ];
        const unevaluatedDocs = submissionsSnapshot.docs.filter(doc => !doc.data().evaluated);
        for (const doc of unevaluatedDocs) {
            const submission = doc.data();
            const evaluationPromises = judgeWeights.map(async (jw) => {
                var _a;
                const judge = (_a = judgesConfig === null || judgesConfig === void 0 ? void 0 : judgesConfig.judges) === null || _a === void 0 ? void 0 : _a.find((j) => j.judgeId === jw.judgeId);
                if (!judge)
                    return null;
                return evaluateWithJudge(openai, judge, scenario, submission.response, sessionConfig, game.knowledgeBase || '', game.referenceDocs || '');
            });
            const evaluations = (await Promise.all(evaluationPromises)).filter(Boolean);
            let totalWeight = 0;
            let weightedScore = 0;
            const conceptsIdentified = [];
            evaluations.forEach((evaluation, index) => {
                var _a;
                const weight = ((_a = judgeWeights[index]) === null || _a === void 0 ? void 0 : _a.weight) || 0.33;
                weightedScore += evaluation.score * weight;
                totalWeight += weight;
                if (evaluation.rawResponse && Array.isArray(evaluation.rawResponse.conceptsIdentified)) {
                    conceptsIdentified.push(...evaluation.rawResponse.conceptsIdentified);
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
        const scores = [];
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
        return { success: true, rankings };
    }
    catch (error) {
        console.error('Process round error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to process round');
    }
});
// =====================================
// GENERATE STUDENT REPORT
// =====================================
exports.generateStudentReport = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .https.onCall(async (data, context) => {
    var _a, _b;
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
        const game = gameDoc.data();
        const submissionsSnapshot = await db.collection('games').doc(gameCode)
            .collection('submissions')
            .where('playerId', '==', targetPlayerId)
            .orderBy('round')
            .get();
        const roundDetails = submissionsSnapshot.docs.map(doc => {
            var _a;
            const data = doc.data();
            return {
                round: data.round,
                scenario: ((_a = game.scenarios[data.round - 1]) === null || _a === void 0 ? void 0 : _a.title) || `Ronda ${data.round}`,
                response: data.response,
                evaluation: data.evaluation,
            };
        });
        const totalScore = roundDetails.reduce((sum, r) => { var _a; return sum + (((_a = r.evaluation) === null || _a === void 0 ? void 0 : _a.finalScore) || 0); }, 0);
        const avgScore = roundDetails.length > 0 ? Math.round(totalScore / roundDetails.length) : 0;
        const allStrengths = [];
        const allImprovements = [];
        const allConcepts = [];
        roundDetails.forEach(r => {
            var _a;
            if (r.evaluation) {
                (_a = r.evaluation.evaluations) === null || _a === void 0 ? void 0 : _a.forEach((e) => {
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
                sessionTitle: ((_a = game.sessionConfig) === null || _a === void 0 ? void 0 : _a.title) || 'Sesión',
                playerId: targetPlayerId,
                totalRounds: ((_b = game.scenarios) === null || _b === void 0 ? void 0 : _b.length) || 0,
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
    }
    catch (error) {
        console.error('Generate report error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to generate report');
    }
});
// =====================================
// GENERATE ORAL TASK
// =====================================
exports.generateOralTask = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '512MB', secrets: ['OPENAI_API_KEY'] })
    .https.onCall(async (data, context) => {
    var _a, _b;
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
        const totalScore = roundDetails.reduce((sum, r) => { var _a; return sum + (((_a = r.evaluation) === null || _a === void 0 ? void 0 : _a.finalScore) || 0); }, 0);
        const avgScore = roundDetails.length > 0 ? Math.round(totalScore / roundDetails.length) : 0;
        const allImprovements = [];
        const allConcepts = [];
        roundDetails.forEach(r => {
            var _a;
            if (r.evaluation) {
                (_a = r.evaluation.evaluations) === null || _a === void 0 ? void 0 : _a.forEach((e) => {
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
        const taskContent = JSON.parse(((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '{}');
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
    }
    catch (error) {
        console.error('Generate oral task error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to generate oral task');
    }
});
// =====================================
// SEED JUDGES (One-time initialization)
// =====================================
exports.seedJudges = functions
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
    }
    catch (error) {
        console.error('Seed judges error:', error);
        res.status(500).json({ success: false, error: 'Failed to seed judges' });
    }
});
//# sourceMappingURL=index.js.map