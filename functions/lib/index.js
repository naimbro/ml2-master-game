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
exports.seedJudges = exports.exportSignalsSummary = exports.generateClassReport = exports.generateOralTask = exports.generateStudentReport = exports.recalibrateRound = exports.processRoundEnd = exports.evaluateSubmission = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const recalibration_1 = require("./lib/recalibration");
const pairwise_1 = require("./pairwise");
const stats_1 = require("./lib/stats");
const parse_1 = require("./lib/parse");
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
// Helper: select only relevant KB sections for a given round's conceptTags
// KB uses HTML comment markers: <!-- section: tag1, tag2 -->
// Sections tagged _always are always included. Others included if any tag matches.
function selectKBSections(knowledgeBase, conceptTags) {
    if (!knowledgeBase || !(conceptTags === null || conceptTags === void 0 ? void 0 : conceptTags.length))
        return knowledgeBase || '';
    const parts = knowledgeBase.split(/<!--\s*section:\s*(.*?)\s*-->/);
    // parts[0] = preamble (before first marker), parts[1] = tags, parts[2] = content, ...
    if (parts.length < 3)
        return knowledgeBase; // no markers found, return full KB
    let result = parts[0].trim(); // preamble (usually empty or title)
    for (let i = 1; i < parts.length; i += 2) {
        const sectionTags = parts[i].split(',').map((t) => t.trim());
        const sectionContent = parts[i + 1] || '';
        if (sectionTags.includes('_always') || sectionTags.some((t) => conceptTags.includes(t))) {
            result += '\n' + sectionContent.trim();
        }
    }
    return result.trim();
}
// Helper: build compact rubric for prompt (drops verbose fields)
function buildCompactRubric(rubric) {
    const dimensions = (rubric.dimensions || []);
    return {
        globalInstructions: rubric.globalInstructions,
        dimensions: dimensions.map(d => ({
            id: d.id, name: d.name, weight: d.weight, description: d.description,
            level_100: d.level_100, level_60: d.level_60, level_20: d.level_20,
        })),
        hardPenalties: rubric.hardPenalties || rubric.globalPenalties,
        softPenalties: rubric.softPenalties,
    };
}
// Helper function to evaluate with a single judge
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function evaluateWithJudge(openai, judge, scenario, studentResponse, sessionConfig, knowledgeBase, referenceDocs, isRanked = true) {
    var _a, _b;
    // Strip evaluation data and non-essential fields from scenario for prompt
    const scenarioForPrompt = { ...scenario };
    delete scenarioForPrompt.idealAnswer;
    delete scenarioForPrompt.evaluationGuide;
    delete scenarioForPrompt.conceptTags;
    delete scenarioForPrompt.nice_to_have;
    delete scenarioForPrompt.referenceAnswer;
    // Select only relevant KB sections for this round
    const conceptTags = (scenario.conceptTags || []);
    const relevantKB = selectKBSections(knowledgeBase, conceptTags);
    // Build compact rubric (3 anchor levels, no bonusIndicators)
    const rubricConfig = (sessionConfig.rubric || {});
    const compactRubric = buildCompactRubric(rubricConfig);
    let prompt = judge.promptTemplate
        .replace('{{name}}', judge.name)
        .replace('{{personality}}', judge.personality)
        .replace('{{evaluationStyle}}', judge.evaluationStyle)
        .replace('{{knowledgeBase}}', relevantKB || 'No knowledge base provided')
        .replace('{{referenceDocs}}', referenceDocs || '')
        .replace('{{rubric}}', JSON.stringify(compactRubric, null, 2))
        .replace('{{scenario}}', JSON.stringify(scenarioForPrompt, null, 2))
        .replace('{{idealAnswer}}', JSON.stringify(scenario.idealAnswer || {}, null, 2))
        .replace('{{studentResponse}}', studentResponse);
    // Dynamic session-aware replacements for dimension names, formulas, and session lens
    const rubricDimensions = (rubricConfig.dimensions || []);
    const dimensionIds = rubricDimensions.map(d => d.id);
    const dimensionScoresJson = dimensionIds.length > 0
        ? dimensionIds.map(id => `    "${id}": "<0-100>"`).join(',\n')
        : '    "dimension_1": "<0-100>",\n    "dimension_2": "<0-100>",\n    "dimension_3": "<0-100>"';
    const judgeSessionConfig = (sessionConfig.judgeConfig || {})[judge.judgeId] || {};
    const sessionLens = judgeSessionConfig.sessionLens
        ? `\nFOCO ESPECIFICO PARA ESTA SESION:\n${judgeSessionConfig.sessionLens}`
        : '';
    const defaultFormulas = {
        'technical_expert': `score = 0.50 * ${dimensionIds[0] || 'process_structuring'} + 0.10 * ${dimensionIds[1] || 'institutional_realism'} + 0.40 * ${dimensionIds[2] || 'precision_clarity'}`,
        'public_sector': `score = 0.15 * ${dimensionIds[0] || 'process_structuring'} + 0.65 * ${dimensionIds[1] || 'institutional_realism'} + 0.20 * ${dimensionIds[2] || 'precision_clarity'}`,
        'professor_twin': `score = 0.35 * ${dimensionIds[0] || 'process_structuring'} + 0.30 * ${dimensionIds[1] || 'institutional_realism'} + 0.35 * ${dimensionIds[2] || 'precision_clarity'}`,
    };
    const weightFormula = judgeSessionConfig.weightFormula
        || defaultFormulas[judge.judgeId]
        || 'score = weighted average of dimensions';
    const evalGuide = scenario.evaluationGuide
        ? JSON.stringify(scenario.evaluationGuide, null, 2)
        : JSON.stringify(scenario.idealAnswer || {}, null, 2);
    const refAnswer = scenario.referenceAnswer || '';
    prompt = prompt
        .replace('{{dimensionScoresJson}}', dimensionScoresJson)
        .replace('{{weightFormula}}', weightFormula)
        .replace('{{sessionLens}}', sessionLens)
        .replace('{{evaluationGuide}}', evalGuide)
        .replace('{{referenceAnswer}}', refAnswer ? `${refAnswer}\n\nCALIBRACION: La respuesta de referencia muestra el nivel de detalle y extension ESPERADO para una buena respuesta (~80 pts). NO penalices brevedad si los puntos clave estan cubiertos. Respuestas mas cortas que la referencia pero que cubren lo esencial pueden obtener 80+.` : '');
    // For non-ranked rounds, add signal extraction instructions
    if (!isRanked) {
        const scenarioId = scenario.id || '';
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
        }
        else if (isEstilo) {
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
        }
        else {
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
            temperature: 0.5,
            max_tokens: isRanked ? 1200 : 1500,
            response_format: { type: 'json_object' },
        });
        const responseText = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '{}';
        const response = JSON.parse(responseText);
        const evaluation = {
            judgeId: judge.judgeId,
            judgeName: judge.name,
            score: response.score || 0,
            feedback: response.feedback || 'Sin retroalimentacion',
            strengths: response.strengths || [],
            improvements: response.improvements || [],
            rawResponse: response,
            promptUsed: prompt,
        };
        // Extract parsed signals for non-ranked rounds
        if (!isRanked && response.parsedSignals) {
            evaluation.parsedSignals = { ...response.parsedSignals };
            if (response.extractionConfidence !== undefined) {
                evaluation.parsedSignals.extractionConfidence = response.extractionConfidence;
            }
        }
        return evaluation;
    }
    catch (error) {
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
exports.evaluateSubmission = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 120, memory: '512MB', secrets: ['OPENAI_API_KEY'] })
    .https.onCall(async (data, context) => {
    var _a;
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
        // MC blocks are scored client-side — skip AI evaluation
        if (scenario.type === 'multiple_choice') {
            return { success: true, skipped: 'multiple_choice' };
        }
        const judgesDoc = await db.collection('config').doc('judges').get();
        const judgesConfig = judgesDoc.exists ? judgesDoc.data() : null;
        const judgeWeights = sessionConfig.judges || [
            { judgeId: 'technical_expert', weight: 0.35 },
            { judgeId: 'public_sector', weight: 0.35 },
            { judgeId: 'professor_twin', weight: 0.30 },
        ];
        const isRanked = scenario.ranked !== false;
        const evaluationPromises = judgeWeights.map(async (jw) => {
            var _a;
            const judge = (_a = judgesConfig === null || judgesConfig === void 0 ? void 0 : judgesConfig.judges) === null || _a === void 0 ? void 0 : _a.find((j) => j.judgeId === jw.judgeId);
            if (!judge) {
                console.warn(`Judge ${jw.judgeId} not found`);
                return null;
            }
            return evaluateWithJudge(openai, judge, scenario, submission.response, sessionConfig, game.knowledgeBase || '', game.referenceDocs || '', isRanked);
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
        // Race condition guard: re-read to check if already evaluated
        // (processRoundEnd may have evaluated this submission concurrently)
        const freshDoc = await submissionRef.get();
        if ((_a = freshDoc.data()) === null || _a === void 0 ? void 0 : _a.evaluated) {
            return { success: true, alreadyEvaluated: true };
        }
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
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { gameCode, round } = data;
    if (!gameCode || round === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing gameCode or round');
    }
    const openai = await getOpenAI();
    try {
        // Idempotency check: if round was already processed, return existing results
        const roundDocRef = db.collection('games').doc(gameCode)
            .collection('rounds').doc(`round_${round}`);
        const existingRound = await roundDocRef.get();
        if (existingRound.exists) {
            const data = existingRound.data();
            return { success: true, rankings: data.rankings, ranked: data.ranked, alreadyProcessed: true };
        }
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
        const isRanked = scenario.ranked !== false;
        const unevaluatedDocs = submissionsSnapshot.docs.filter(doc => !doc.data().evaluated);
        for (const doc of unevaluatedDocs) {
            const submission = doc.data();
            const evaluationPromises = judgeWeights.map(async (jw) => {
                var _a;
                const judge = (_a = judgesConfig === null || judgesConfig === void 0 ? void 0 : judgesConfig.judges) === null || _a === void 0 ? void 0 : _a.find((j) => j.judgeId === jw.judgeId);
                if (!judge)
                    return null;
                return evaluateWithJudge(openai, judge, scenario, submission.response, sessionConfig, game.knowledgeBase || '', game.referenceDocs || '', isRanked);
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
            var _a, _b;
            if (index > 0 && s.score < scores[index - 1].score) {
                currentRank = index + 1;
            }
            // Include cumulative totalScore so frontend doesn't depend on game doc race
            const prevTotal = ((_b = (_a = game.players) === null || _a === void 0 ? void 0 : _a[s.playerId]) === null || _b === void 0 ? void 0 : _b.totalScore) || 0;
            const cumulativeTotal = isRanked ? prevTotal + s.score : prevTotal;
            return { ...s, rank: currentRank, totalScore: cumulativeTotal };
        });
        await db.collection('games').doc(gameCode)
            .collection('rounds').doc(`round_${round}`).set({
            round,
            ranked: isRanked,
            phase: 'provisional',
            rankings,
            processedAt: admin.firestore.Timestamp.now(),
        });
        // Non-ranked rounds are never recalibrated — mark them final so the client
        // does not wait for a Phase 2 that will not come.
        if (!isRanked) {
            await db.collection('games').doc(gameCode)
                .collection('rounds').doc(`round_${round}`)
                .update({ phase: 'final' });
        }
        // Only update player totalScores for ranked rounds
        if (isRanked) {
            const playerUpdates = {};
            for (const score of scores) {
                const currentPlayer = (_a = game.players) === null || _a === void 0 ? void 0 : _a[score.playerId];
                const currentTotal = (currentPlayer === null || currentPlayer === void 0 ? void 0 : currentPlayer.totalScore) || 0;
                playerUpdates[`players.${score.playerId}.totalScore`] = currentTotal + score.score;
            }
            if (Object.keys(playerUpdates).length > 0) {
                await db.collection('games').doc(gameCode).update(playerUpdates);
            }
        }
        return { success: true, rankings, ranked: isRanked };
    }
    catch (error) {
        console.error('Process round error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to process round');
    }
});
const RECAL_B = 4; // Swiss band width (calibrated)
const RECAL_W_ANCHOR = 0.35; // anchor weight / λ≈3 (calibrated)
const RECAL_CONCURRENCY = 10;
exports.recalibrateRound = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 300, memory: '1GB', secrets: ['OPENAI_API_KEY'] })
    .https.onCall(async (data, context) => {
    var _a, _b, _c;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { gameCode, round } = data;
    if (!gameCode || round === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing gameCode or round');
    }
    const roundRef = db.collection('games').doc(gameCode).collection('rounds').doc(`round_${round}`);
    const roundSnap = await roundRef.get();
    if (!roundSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Round not processed yet');
    }
    const roundData = roundSnap.data();
    const gameDoc = await db.collection('games').doc(gameCode).get();
    const game = gameDoc.data();
    if (!game) {
        throw new functions.https.HttpsError('not-found', 'Game not found');
    }
    if (game.hostId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Only the host can recalibrate');
    }
    // Only a provisional ranked round can be recalibrated (idempotent; blocks concurrent runs).
    if (roundData.phase !== 'provisional' || roundData.ranked === false) {
        return { success: true, alreadyFinal: true };
    }
    // Claim the round so a concurrent invocation bails.
    await roundRef.update({ phase: 'recalibrating' });
    try {
        const scenario = (_a = game.scenarios) === null || _a === void 0 ? void 0 : _a[round - 1];
        // Load evaluated submissions with answer text.
        const subsSnap = await db.collection('games').doc(gameCode).collection('submissions')
            .where('round', '==', round).get();
        const players = subsSnap.docs
            .map((d) => d.data())
            .filter((s) => s.evaluation && typeof s.response === 'string' && s.response.trim()
            && Number.isFinite((0, parse_1.coerceScore)(s.evaluation.finalScore)))
            .map((s) => ({ id: s.playerId, prov: (0, parse_1.coerceScore)(s.evaluation.finalScore), response: s.response.trim() }));
        // Need at least 2 answers to form a single duel — otherwise mark final as-is.
        if (players.length < 2) {
            await roundRef.update({ phase: 'final', recalibratedAt: admin.firestore.Timestamp.now() });
            return { success: true, skipped: 'too_few' };
        }
        // Build the round context (task + rubric) for the comparator.
        const rubric = (((_c = (_b = game.sessionConfig) === null || _b === void 0 ? void 0 : _b.rubric) === null || _c === void 0 ? void 0 : _c.dimensions) || [])
            .map((x) => `- ${x.name || x.id}: ${x.description || ''}`).join('\n');
        const ideal = (scenario === null || scenario === void 0 ? void 0 : scenario.idealAnswer) ? JSON.stringify(scenario.idealAnswer).slice(0, 1200) : '';
        const context = [
            `TAREA: ${(scenario === null || scenario === void 0 ? void 0 : scenario.title) || ''}`,
            (scenario === null || scenario === void 0 ? void 0 : scenario.context) ? `CONTEXTO: ${scenario.context}` : '',
            (scenario === null || scenario === void 0 ? void 0 : scenario.question) ? `PREGUNTA: ${typeof scenario.question === 'string' ? scenario.question : JSON.stringify(scenario.question)}` : '',
            rubric ? `CRITERIOS:\n${rubric}` : '',
            ideal ? `REFERENCIA: ${ideal}` : '',
        ].filter(Boolean).join('\n\n');
        const system = (0, pairwise_1.buildComparePrompt)(context);
        // Name / provisional-score / provisional-rank maps (needed up front for the stream).
        const nameById = {};
        subsSnap.docs.forEach((d) => { const s = d.data(); nameById[s.playerId] = s.playerName; });
        const provScoreMap = {};
        players.forEach((p) => (provScoreMap[p.id] = Math.round(p.prov)));
        const provRankMap = (0, stats_1.ranksDescending)(provScoreMap);
        // Announce the total number of duels so the client can pace/progress.
        const scheduleOrder = (0, recalibration_1.sortByProvisional)(players.map((p) => ({ id: p.id, prov: p.prov })));
        const duelTotal = (0, recalibration_1.swissPairs)(scheduleOrder, RECAL_B).length;
        await roundRef.update({ duelTotal });
        // Stream each duel to rounds/round_N/duels/{seq} as it resolves.
        const onDuel = async (d) => {
            const pa = players[d.i], pb = players[d.j];
            const aRank = provRankMap[pa.id], bRank = provRankMap[pb.id];
            const winIdx = d.winner === 0 ? d.i : d.winner === 1 ? d.j : -1;
            const isUpset = winIdx >= 0 && (winIdx === d.i ? aRank > bRank : bRank > aRank);
            const winner = d.winner === 0 ? 'a' : d.winner === 1 ? 'b' : 'tie';
            await roundRef.collection('duels').doc(String(d.seq).padStart(4, '0')).set({
                seq: d.seq,
                a: { name: nameById[pa.id], provRank: aRank, provScore: provScoreMap[pa.id] },
                b: { name: nameById[pb.id], provRank: bRank, provScore: provScoreMap[pb.id] },
                winner, isUpset,
            });
        };
        // Real comparator: one gpt-4o head-to-head.
        const openai = await getOpenAI();
        const compare = async (a, b) => {
            var _a, _b;
            try {
                const c = await openai.chat.completions.create({
                    model: 'gpt-4o', temperature: 0, max_tokens: 20,
                    response_format: { type: 'json_object' },
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: `RESPUESTA A:\n${a}\n\nRESPUESTA B:\n${b}` },
                    ],
                }, { timeout: 25000, maxRetries: 1 });
                const w = JSON.parse(((_b = (_a = c.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '{}').winner;
                return w === 'A' || w === 'B' ? w : 'tie';
            }
            catch (e) {
                console.error('compare error', e);
                return 'tie';
            }
        };
        const duels = await (0, pairwise_1.runSwissComparisons)(players, context, RECAL_B, compare, RECAL_CONCURRENCY, onDuel);
        const recalPlayers = players.map((p) => ({ id: p.id, prov: p.prov }));
        const recalScore = (0, recalibration_1.recalibrateScores)(recalPlayers, duels, RECAL_W_ANCHOR);
        // Flag the most dramatic upset for the client's climax replay.
        const provRankByIndex = players.map((p) => provRankMap[p.id]);
        const climaxSeq = (0, recalibration_1.pickClimax)(duels, provRankByIndex);
        if (climaxSeq !== null) {
            await roundRef.collection('duels').doc(String(climaxSeq).padStart(4, '0'))
                .update({ isClimax: true }).catch(() => { });
        }
        // prevTotal = cumulative through round N-1. game.players[id].totalScore already
        // includes THIS round's provisional score (written by processRoundEnd for ranked
        // rounds), so subtract it back off. Robust to students absent in round N-1.
        const prevTotal = {};
        players.forEach((p) => {
            var _a, _b;
            const cumThroughN = ((_b = (_a = game.players) === null || _a === void 0 ? void 0 : _a[p.id]) === null || _b === void 0 ? void 0 : _b.totalScore) || 0;
            prevTotal[p.id] = cumThroughN - Math.round(p.prov);
        });
        const recalRankMap = (0, stats_1.ranksDescending)(recalScore);
        const rankings = players
            .map((p) => {
            const s = Math.round(recalScore[p.id]);
            return {
                playerId: p.id,
                playerName: nameById[p.id],
                score: s,
                rank: recalRankMap[p.id],
                totalScore: (prevTotal[p.id] || 0) + s,
                provScore: provScoreMap[p.id],
                provRank: provRankMap[p.id],
            };
        })
            .sort((a, b) => a.rank - b.rank);
        await roundRef.update({
            phase: 'final',
            rankings,
            recalibratedAt: admin.firestore.Timestamp.now(),
        });
        // Update the game-doc cumulative cache to the recalibrated totals.
        const playerUpdates = {};
        for (const r of rankings)
            playerUpdates[`players.${r.playerId}.totalScore`] = r.totalScore;
        if (Object.keys(playerUpdates).length > 0) {
            await db.collection('games').doc(gameCode).update(playerUpdates);
        }
        return { success: true, rankings };
    }
    catch (error) {
        console.error('Recalibration error:', error);
        // Graceful degradation: leave the round provisional (treated as final by clients).
        await roundRef.update({ phase: 'final', recalibratedAt: admin.firestore.Timestamp.now() }).catch(() => { });
        throw new functions.https.HttpsError('internal', 'Recalibration failed; provisional standings kept');
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
            const data = doc.data();
            const scenarioData = game.scenarios[data.round - 1];
            return {
                round: data.round,
                ranked: (scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.ranked) !== false,
                scenario: (scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.title) || `Ronda ${data.round}`,
                response: data.response,
                evaluation: data.evaluation,
            };
        });
        // Only sum ranked round scores for totalScore/averageScore
        const rankedRounds = roundDetails.filter(r => r.ranked);
        const totalScore = rankedRounds.reduce((sum, r) => { var _a; return sum + (((_a = r.evaluation) === null || _a === void 0 ? void 0 : _a.finalScore) || 0); }, 0);
        const avgScore = rankedRounds.length > 0 ? Math.round(totalScore / rankedRounds.length) : 0;
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
// GENERATE CLASS REPORT (Professor)
// =====================================
exports.generateClassReport = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .https.onCall(async (data, context) => {
    var _a, _b;
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
        const game = gameDoc.data();
        // Verify user is the host
        if (game.hostId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Only the host can generate class reports');
        }
        // Get all submissions for this game
        const submissionsSnapshot = await db.collection('games').doc(gameCode)
            .collection('submissions')
            .get();
        // Group submissions by player and round
        const playerData = {};
        submissionsSnapshot.docs.forEach(doc => {
            var _a, _b, _c, _d;
            const data = doc.data();
            const playerId = data.playerId;
            const scenarioData = (_a = game.scenarios) === null || _a === void 0 ? void 0 : _a[data.round - 1];
            const isRoundRanked = (scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.ranked) !== false;
            if (!playerData[playerId]) {
                playerData[playerId] = {
                    name: data.playerName || 'Anonimo',
                    roundScores: {},
                    totalScore: 0,
                    roundDetails: [],
                };
            }
            const score = ((_b = data.evaluation) === null || _b === void 0 ? void 0 : _b.finalScore) || 0;
            playerData[playerId].roundScores[data.round] = score;
            // Only sum ranked round scores
            if (isRoundRanked) {
                playerData[playerId].totalScore += score;
            }
            // Collect feedback
            const strengths = [];
            const improvements = [];
            (_d = (_c = data.evaluation) === null || _c === void 0 ? void 0 : _c.evaluations) === null || _d === void 0 ? void 0 : _d.forEach((e) => {
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
        const roundAverages = {};
        for (let r = 1; r <= game.totalRounds; r++) {
            const roundScores = players
                .map(p => p.roundScores[r])
                .filter(s => s !== undefined);
            if (roundScores.length > 0) {
                roundAverages[r] = Math.round(roundScores.reduce((a, b) => a + b, 0) / roundScores.length);
            }
        }
        // Collect all improvement areas (most common)
        const allImprovements = {};
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
                sessionTitle: ((_a = game.sessionConfig) === null || _a === void 0 ? void 0 : _a.title) || 'Sesion',
                totalRounds: game.totalRounds,
                totalPlayers: players.length,
                classAverage,
                distribution,
                roundAverages,
                topImprovementAreas,
                players: rankedPlayers,
                scenarios: ((_b = game.scenarios) === null || _b === void 0 ? void 0 : _b.map((s, i) => ({
                    round: i + 1,
                    title: s.title,
                    category: s.category,
                }))) || [],
                generatedAt: admin.firestore.Timestamp.now(),
            },
        };
    }
    catch (error) {
        console.error('Generate class report error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to generate class report');
    }
});
// =====================================
// EXPORT SIGNALS SUMMARY (Professor)
// =====================================
exports.exportSignalsSummary = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .https.onCall(async (data, context) => {
    var _a;
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
        const game = gameDoc.data();
        // Verify user is the host
        if (game.hostId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Only the host can export signals');
        }
        const submissionsSnapshot = await db.collection('games').doc(gameCode)
            .collection('submissions')
            .get();
        // Build scenario info
        const scenarioInfo = (game.scenarios || []).map((s, i) => ({
            round: i + 1,
            id: s.id,
            title: s.title,
            ranked: s.ranked !== false,
        }));
        // Group by student
        const studentData = {};
        submissionsSnapshot.docs.forEach(doc => {
            var _a, _b, _c, _d, _e, _f;
            const sub = doc.data();
            const playerId = sub.playerId;
            const roundIdx = sub.round - 1;
            const scenarioData = (_a = game.scenarios) === null || _a === void 0 ? void 0 : _a[roundIdx];
            const isRoundRanked = (scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.ranked) !== false;
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
                const judgeScores = {};
                (_c = (_b = sub.evaluation) === null || _b === void 0 ? void 0 : _b.evaluations) === null || _c === void 0 ? void 0 : _c.forEach((e) => {
                    judgeScores[e.judgeId] = e.score;
                });
                studentData[playerId].hardSignals[roundKey] = {
                    finalScore: ((_d = sub.evaluation) === null || _d === void 0 ? void 0 : _d.finalScore) || 0,
                    judgeScores,
                };
            }
            else {
                // Soft signals: merge parsedSignals from evaluations
                const merged = {};
                (_f = (_e = sub.evaluation) === null || _e === void 0 ? void 0 : _e.evaluations) === null || _f === void 0 ? void 0 : _f.forEach((e) => {
                    if (e.parsedSignals) {
                        Object.assign(merged, e.parsedSignals);
                    }
                });
                studentData[playerId].softSignals[roundKey] = merged;
            }
        });
        // Build per-scenario aggregates
        const scenarioSummary = {};
        for (const scenario of scenarioInfo) {
            if (!scenario.ranked) {
                const roundKey = `round_${scenario.round}`;
                const allInterests = [];
                const roles = {};
                let n = 0;
                Object.values(studentData).forEach(student => {
                    const signals = student.softSignals[roundKey];
                    if (signals) {
                        n++;
                        // Collect interest values
                        const interest = signals.interestByScenario;
                        if (interest) {
                            Object.values(interest).forEach(v => {
                                if (typeof v === 'number')
                                    allInterests.push(v);
                            });
                        }
                        // Collect roles
                        const role = signals.preferredRole;
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
                sessionTitle: ((_a = game.sessionConfig) === null || _a === void 0 ? void 0 : _a.title) || 'Sesion',
                exportedAt: admin.firestore.Timestamp.now(),
                scenarioInfo,
                scenarioSummary,
                students,
            },
        };
    }
    catch (error) {
        console.error('Export signals error:', error);
        throw new functions.https.HttpsError('internal', 'Failed to export signals summary');
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
        // Check if judges already exist (skip with ?force=true)
        const force = req.query.force === 'true';
        const judgesDoc = await db.collection('config').doc('judges').get();
        if (judgesDoc.exists && !force) {
            res.json({ success: true, message: 'Judges already configured. Use ?force=true to overwrite.', exists: true });
            return;
        }
        // Shared rubric scoring instructions injected into every judge prompt
        const rubricInstructions = `
INSTRUCCIONES DE SCORING:
1. "judgeFocus" del escenario es tu PRIORIDAD.
2. Puntua CADA dimension (ver rubrica). "hardPenalties" = TECHO en esa dimension. "softPenalties" = deduccion.
3. GUIA DE EVALUACION: verifica must_hit/fatal_errors, pero acepta respuestas alternativas correctas.
4. Calcula score final con la FORMULA DE PESOS de tus instrucciones finales.
5. Feedback: nombra la dimension mas debil. Se ESPECIFICO. No repitas la pregunta.`;
        const defaultJudges = {
            judges: [
                {
                    judgeId: 'technical_expert',
                    name: 'Dr. Tech',
                    avatar: '🔬',
                    personality: 'Eres un ingeniero de sistemas de IA con 15 anos de experiencia. Has construido pipelines de datos en Google y consultado para gobiernos. Eres preciso, clinico, y te fijas en los detalles que otros ignoran. No te impresionan las buenas intenciones — te importa si la respuesta es operacionalmente correcta.',
                    evaluationStyle: 'Tu lente principal: operacionalizacion, reproducibilidad, estructura de outputs y precision causal. Te fijas en si la respuesta distingue trabajo manual de procesamiento programatico, si propone una secuencia ejecutable, y si el output seria usable por otro sistema o equipo. Penalizas vaguedad como "es mas eficiente" si no explica que parte del proceso mejora y como.',
                    focusDimensions: ['process_structuring', 'precision_clarity'],
                    promptTemplate: `MATERIAL DE REFERENCIA:
{{knowledgeBase}}

RUBRICA:
{{rubric}}

ESCENARIO:
{{scenario}}

GUIA DE EVALUACION:
{{evaluationGuide}}

RESPUESTA DE REFERENCIA (tono y extension esperados):
{{referenceAnswer}}

RESPUESTA DEL ESTUDIANTE:
{{studentResponse}}

${rubricInstructions}

---

AHORA EVALUA COMO {{name}}.

{{personality}}

TU LENTE DE EVALUACION:
{{evaluationStyle}}
{{sessionLens}}

INSTRUCCIONES FINALES PARA Dr. Tech:
- Feedback CLINICO: senala errores de especificacion como un ingeniero. Se directo, sin lenguaje motivacional.
- FORMULA DE PESOS: {{weightFormula}}

Responde SOLO con JSON valido:
{
  "score": "<0-100, calcula con la formula de pesos>",
  "dimensionScores": {
{{dimensionScoresJson}}
  },
  "feedback": "<2-3 oraciones tecnicas, SIN repetir la probingQuestion>",
  "strengths": ["<fortaleza concreta>"],
  "improvements": ["<mejora concreta y accionable>"],
  "penaltiesApplied": ["<penalidad aplicada, o vacio>"],
  "conceptsIdentified": ["<concepto correctamente usado>"],
  "probingQuestion": "<UNA pregunta tecnica que expone un gap en la respuesta>"
}`
                },
                {
                    judgeId: 'public_sector',
                    name: 'Ministra Digital',
                    avatar: '🏛️',
                    personality: 'Eres una ex-Subsecretaria de Gobierno Digital de Chile. Has implementado y visto fracasar proyectos de tecnologia en el Estado. Conoces las restricciones reales: presupuestos rigidos, equipos chicos, rotacion de autoridades, resistencia de funcionarios, y la obligacion de transparencia. No toleras respuestas que ignoren donde se va a implementar esto.',
                    evaluationStyle: 'Tu lente principal: gobernanza, viabilidad institucional y resguardos. Te preguntas: quien va a usar esto y bajo que condiciones? Que pasa con la confidencialidad? Hay trazabilidad y accountability? Se necesita validacion humana? Valoras cuando alguien identifica restricciones reales del contexto. Penalizas cuando alguien asume que la tecnologia se implementa sola.',
                    focusDimensions: ['institutional_realism'],
                    promptTemplate: `MATERIAL DE REFERENCIA:
{{knowledgeBase}}

RUBRICA:
{{rubric}}

ESCENARIO:
{{scenario}}

GUIA DE EVALUACION:
{{evaluationGuide}}

RESPUESTA DE REFERENCIA (tono y extension esperados):
{{referenceAnswer}}

RESPUESTA DEL ESTUDIANTE:
{{studentResponse}}

${rubricInstructions}

---

AHORA EVALUA COMO {{name}}.

{{personality}}

TU LENTE DE EVALUACION:
{{evaluationStyle}}
{{sessionLens}}

INSTRUCCIONES FINALES PARA Ministra Digital:
- Feedback desde perspectiva INSTITUCIONAL, no tecnica. Tu valor es la perspectiva de gobernanza y viabilidad.
- Si la respuesta omite una restriccion institucional relevante para ESTE caso, nombrala. No inventes carencias si no las hay.
- Usa lenguaje institucional chileno solo cuando sea pertinente al caso. No fuerces terminologia burocratica irrelevante.
- FORMULA DE PESOS: {{weightFormula}}

Responde SOLO con JSON valido:
{
  "score": "<0-100, calcula con la formula de pesos>",
  "dimensionScores": {
{{dimensionScoresJson}}
  },
  "feedback": "<2-3 oraciones desde perspectiva institucional>",
  "strengths": ["<fortaleza concreta>"],
  "improvements": ["<restriccion o riesgo institucional relevante que omitio, si aplica>"],
  "penaltiesApplied": ["<penalidad aplicada, o vacio>"],
  "missedConstraints": ["<restriccion institucional concreta no considerada, si aplica>"]
}`
                },
                {
                    judgeId: 'professor_twin',
                    name: 'Profe Naim',
                    avatar: '👨‍🏫',
                    personality: 'Eres el profesor del curso. Eres directo, exigente, y no te gustan las respuestas que "suenan bien" pero no dicen nada. Te frustra cuando un estudiante llena espacio con generalidades en vez de pensar. Valoras la honestidad intelectual: preferir "no se" a inventar. Pero tambien premias cuando alguien va mas alla de lo pedido con un insight propio.',
                    evaluationStyle: 'Tu lente principal: sintesis, especificidad y comprension operativa. Te preguntas: esta persona PENSO o solo lleno los campos? Distingue lo importante de lo accesorio? Conecta la decision tecnica con su consecuencia concreta? Penalizas respuestas que podrian aplicar a cualquier problema sin modificar. Premias conexiones concretas entre herramienta y consecuencia (ej: salida estructurada, integracion en sistema, estandarizacion de criterio).',
                    focusDimensions: ['critical_thinking', 'synthesis'],
                    promptTemplate: `MATERIAL DE REFERENCIA:
{{knowledgeBase}}

RUBRICA:
{{rubric}}

ESCENARIO:
{{scenario}}

GUIA DE EVALUACION:
{{evaluationGuide}}

RESPUESTA DE REFERENCIA (tono y extension esperados):
{{referenceAnswer}}

RESPUESTA DEL ESTUDIANTE:
{{studentResponse}}

${rubricInstructions}

---

AHORA EVALUA COMO {{name}}.

{{personality}}

TU LENTE DE EVALUACION:
{{evaluationStyle}}
{{sessionLens}}

INSTRUCCIONES FINALES PARA Profe Naim:
- Habla en PRIMERA PERSONA. Di "yo habria..." — como feedback cara a cara. Justo, directo, calibrado al nivel de la ronda.
- Si la respuesta es realmente generica (podria pegarse casi igual en otro caso distinto sin modificar nada), aplica tope de 50 en la tercera dimension. Dilo explicitamente. Pero una respuesta concisa y correcta NO es automaticamente generica.
- Si la respuesta es buena, di por que con la misma especificidad.
- FORMULA DE PESOS: {{weightFormula}}

Responde SOLO con JSON valido:
{
  "score": "<0-100, calcula con la formula de pesos>",
  "dimensionScores": {
{{dimensionScoresJson}}
  },
  "feedback": "<2-3 oraciones en primera persona, incluye 'yo habria...' con alternativa concreta>",
  "strengths": ["<fortaleza concreta>"],
  "improvements": ["<que debio hacer distinto, especifico al caso>"],
  "penaltiesApplied": ["<penalidad aplicada, o vacio>"],
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
    }
    catch (error) {
        console.error('Seed judges error:', error);
        res.status(500).json({ success: false, error: 'Failed to seed judges' });
    }
});
//# sourceMappingURL=index.js.map