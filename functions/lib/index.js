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
exports.generateSessionDraft = exports.seedJudges = exports.exportSignalsSummary = exports.generateClassReport = exports.generateOralTask = exports.generateStudentReport = exports.recalibrateRound = exports.processRoundEnd = exports.evaluateSubmission = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const recalibration_1 = require("./lib/recalibration");
const pairwise_1 = require("./pairwise");
const stats_1 = require("./lib/stats");
const parse_1 = require("./lib/parse");
const scoring_1 = require("./lib/scoring");
const judgeModels_1 = require("./lib/judgeModels");
const promptSplit_1 = require("./lib/promptSplit");
const sessionDraft_1 = require("./lib/sessionDraft");
const judgeOverrides_1 = require("./lib/judgeOverrides");
admin.initializeApp();
const db = admin.firestore();
// Lazy-load SDKs to avoid initialization timeout (they load only when a judge of
// that provider actually runs).
let openaiModule = null;
async function getOpenAIModule() {
    if (!openaiModule) {
        openaiModule = await Promise.resolve().then(() => __importStar(require('openai')));
    }
    return openaiModule;
}
let anthropicModule = null;
async function getAnthropicModule() {
    if (!anthropicModule) {
        anthropicModule = await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')));
    }
    return anthropicModule;
}
let genaiModule = null;
async function getGenaiModule() {
    if (!genaiModule) {
        genaiModule = await Promise.resolve().then(() => __importStar(require('@google/genai')));
    }
    return genaiModule;
}
/**
 * Combine per-judge scores into a round score.
 *
 * Weights are looked up BY judgeId, not by array position: `evaluations` may be
 * shorter than `judgeWeights` (a judge missing from config/judges is filtered
 * out), and positional lookup silently shifts every subsequent weight onto the
 * wrong judge.
 *
 * Failed judges are dropped rather than scored — a judge that times out used to
 * contribute a neutral 50, which quietly dragged strong answers down and weak
 * ones up. `totalWeight` renormalizes over whoever actually answered.
 */
function aggregateEvaluations(evaluations, judgeWeights) {
    var _a;
    const weightById = new Map(judgeWeights.map((jw) => [jw.judgeId, jw.weight]));
    const conceptsIdentified = [];
    const failedJudges = [];
    let totalWeight = 0;
    let weightedScore = 0;
    for (const evaluation of evaluations) {
        const raw = evaluation.rawResponse;
        if (raw && Array.isArray(raw.conceptsIdentified)) {
            conceptsIdentified.push(...raw.conceptsIdentified);
        }
        if (evaluation.failed || !Number.isFinite(evaluation.score)) {
            failedJudges.push(evaluation.judgeId);
            continue;
        }
        const weight = (_a = weightById.get(evaluation.judgeId)) !== null && _a !== void 0 ? _a : 0;
        weightedScore += evaluation.score * weight;
        totalWeight += weight;
    }
    return {
        finalScore: totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0,
        conceptsIdentified: [...new Set(conceptsIdentified)],
        failedJudges,
    };
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
async function getAnthropic() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY secret not configured');
    }
    const { default: Anthropic } = await getAnthropicModule();
    return new Anthropic({ apiKey });
}
async function getGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY secret not configured');
    }
    const { GoogleGenAI } = await getGenaiModule();
    return new GoogleGenAI({ apiKey });
}
/**
 * Per-course judge persona overrides (name/avatar/personality/evaluationStyle),
 * written live from the frontend and layered over the seeded config/judges baseline.
 * Returns null when the course has no overrides (or the game predates courseId).
 */
async function loadJudgeOverrides(courseId) {
    if (!courseId)
        return null;
    try {
        const snap = await db.collection('judgeOverrides').doc(courseId).get();
        return snap.exists ? snap.data() : null;
    }
    catch (err) {
        console.warn(`Failed to load judgeOverrides for course ${courseId}; using baseline judges.`, err);
        return null;
    }
}
/**
 * Construct exactly the provider clients a set of judges needs.
 *
 * A course whose panel is all-OpenAI never constructs the Anthropic/Gemini
 * clients (and never requires their secrets to be set). A failure to build one
 * provider's client is isolated to that provider — the other judges still run,
 * and the judge whose client is missing fails cleanly (excluded from the mean).
 */
async function buildJudgeClients(judges) {
    const providers = new Set(judges.map((j) => (0, judgeModels_1.resolveProvider)(j)));
    const clients = {};
    await Promise.all([...providers].map(async (p) => {
        try {
            if (p === 'openai')
                clients.openai = await getOpenAI();
            else if (p === 'anthropic')
                clients.anthropic = await getAnthropic();
            else if (p === 'gemini')
                clients.gemini = await getGemini();
        }
        catch (e) {
            console.error(`Failed to init ${p} client — its judges will fail:`, e);
        }
    }));
    return clients;
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
/**
 * Build the rubric the judge actually sees.
 *
 * All SIX anchors are included. They used to be trimmed to three (100/60/20) to
 * save tokens, which was defensible when we asked for a free 0-100 number, but
 * the judge is now asked to *pick* an anchor — so every option it may pick needs
 * its written definition present, or it is choosing between levels it can't read.
 *
 * Dimension `weight` is deliberately omitted: weights are applied in code now, and
 * showing them invited the model to pre-multiply and hand back an aggregate.
 * Penalties are listed WITH their ids, because the judge reports ids back.
 */
function buildCompactRubric(rubric, penalties) {
    const dimensions = (rubric.dimensions || []);
    return {
        globalInstructions: rubric.globalInstructions,
        dimensions: dimensions.map(d => ({
            id: d.id, name: d.name, description: d.description,
            level_100: d.level_100, level_80: d.level_80, level_60: d.level_60,
            level_40: d.level_40, level_20: d.level_20, level_0: d.level_0,
        })),
        penalties: penalties.map(p => ({ id: p.id, description: p.description })),
        softPenalties: rubric.softPenalties,
    };
}
// Helper function to evaluate with a single judge
async function evaluateWithJudge(clients, judge, scenario, studentResponse, sessionConfig, knowledgeBase, referenceDocs, isRanked = true) {
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
    const rubricConfig = (sessionConfig.rubric || {});
    const penaltyDefs = (0, scoring_1.loadPenalties)(rubricConfig);
    const compactRubric = buildCompactRubric(rubricConfig, penaltyDefs);
    // Dynamic session-aware replacements for dimension names, formulas, and session lens
    const rubricDimensions = (rubricConfig.dimensions || []);
    const dimensionIds = rubricDimensions.map(d => d.id);
    // The judge picks ONE OF SIX ANCHORS per dimension — it never emits a free number
    // and never emits an aggregate. Turning "produce a score" into "which of these six
    // written levels describes this answer" makes the task a classification with a
    // definition for every option, which is far more repeatable than a regression.
    const dimensionScoresJson = (dimensionIds.length > 0 ? dimensionIds : ['dimension_1', 'dimension_2', 'dimension_3'])
        .map(id => `    "${id}": <0|20|40|60|80|100>`)
        .join(',\n');
    const judgeSessionConfig = (sessionConfig.judgeConfig || {})[judge.judgeId] || {};
    const sessionLens = judgeSessionConfig.sessionLens
        ? `\nFOCO ESPECIFICO PARA ESTA SESION:\n${judgeSessionConfig.sessionLens}`
        : '';
    // Weights are no longer shown to the judge — they are applied in code (see
    // scoring.ts). The session's weightFormula string is now PARSED and executed
    // rather than handed to the model as prose to do arithmetic with.
    const defaultFormulas = {
        'technical_expert': `score = 0.50 * ${dimensionIds[0] || 'process_structuring'} + 0.10 * ${dimensionIds[1] || 'institutional_realism'} + 0.40 * ${dimensionIds[2] || 'precision_clarity'}`,
        'public_sector': `score = 0.15 * ${dimensionIds[0] || 'process_structuring'} + 0.65 * ${dimensionIds[1] || 'institutional_realism'} + 0.20 * ${dimensionIds[2] || 'precision_clarity'}`,
        'professor_twin': `score = 0.35 * ${dimensionIds[0] || 'process_structuring'} + 0.30 * ${dimensionIds[1] || 'institutional_realism'} + 0.35 * ${dimensionIds[2] || 'precision_clarity'}`,
    };
    const weightFormula = judgeSessionConfig.weightFormula || defaultFormulas[judge.judgeId];
    const dimensionWeights = (0, scoring_1.resolveDimensionWeights)(weightFormula, rubricDimensions);
    // The judge must know which penalty ids exist, because it reports ids back and
    // an id we don't recognize is a hallucination we want to catch, not obey.
    //
    // Two modes, because not every rubric is migrated yet. A rubric with structured
    // `penalties` gets its ceilings applied by scoring.ts, so the judge is told NOT
    // to touch the numbers. A legacy prose rubric has ceilings we cannot execute
    // (they live inside Spanish sentences, sometimes at off-anchor values like 75) —
    // there, the judge keeps self-enforcing exactly as it does today. The point is
    // that no un-migrated session silently loses its ceilings.
    const enforcedInCode = penaltyDefs.some(p => p.effect);
    const penaltyList = penaltyDefs.length === 0
        ? '(ninguna penalizacion declarada para esta sesion)'
        : penaltyDefs.map(p => `- "${p.id}": ${p.description}`).join('\n') + (enforcedInCode
            ? '\n\nEl motor aplica automaticamente los topes y descuentos de estas penalizaciones. '
                + 'Tu unica tarea es reportar los ids gatillados en "penaltiesApplied". NO bajes tu mismo los niveles por estas penalizaciones.'
            : '\n\nIMPORTANTE: estas penalizaciones NO se aplican automaticamente. Ademas de reportar sus ids en '
                + '"penaltiesApplied", debes reflejarlas TU MISMO en los niveles que asignas (ej: si una penalizacion impone '
                + 'un tope de 60 en una dimension, no reportes mas de 60 en esa dimension).');
    if (penaltyDefs.length > 0 && !enforcedInCode) {
        console.warn(`Rubric for session has ${penaltyDefs.length} legacy prose penalties with no executable effect — `
            + 'judge is self-enforcing them. Migrate to structured `penalties` to get code enforcement.');
    }
    const evalGuide = scenario.evaluationGuide
        ? JSON.stringify(scenario.evaluationGuide, null, 2)
        : JSON.stringify(scenario.idealAnswer || {}, null, 2);
    const refAnswer = scenario.referenceAnswer || '';
    // Every slot except {{studentResponse}}. Applied to both halves of the split
    // below: `replace` with a string pattern is a no-op when the slot is absent, so
    // each placeholder is filled in whichever half actually contains it.
    const fill = (text) => text
        .replace('{{name}}', judge.name)
        .replace('{{personality}}', judge.personality)
        .replace('{{evaluationStyle}}', judge.evaluationStyle)
        .replace('{{knowledgeBase}}', relevantKB || 'No knowledge base provided')
        .replace('{{referenceDocs}}', referenceDocs || '')
        .replace('{{rubric}}', JSON.stringify(compactRubric, null, 2))
        .replace('{{scenario}}', JSON.stringify(scenarioForPrompt, null, 2))
        .replace('{{idealAnswer}}', JSON.stringify(scenario.idealAnswer || {}, null, 2))
        .replace('{{dimensionScoresJson}}', dimensionScoresJson)
        .replace('{{penaltyList}}', penaltyList)
        // Legacy slot. Templates still carrying it (e.g. an un-reseeded config/judges
        // in Firestore) get an empty formula rather than an instruction to do algebra.
        .replace('{{weightFormula}}', '(los pesos se aplican en el motor; no calcules un score agregado)')
        .replace('{{sessionLens}}', sessionLens)
        .replace('{{evaluationGuide}}', evalGuide)
        .replace('{{referenceAnswer}}', refAnswer ? `${refAnswer}\n\nCALIBRACION: La respuesta de referencia muestra el nivel de detalle y extension ESPERADO para una buena respuesta (~80 pts). NO penalices brevedad si los puntos clave estan cubiertos. Respuestas mas cortas que la referencia pero que cubren lo esencial pueden obtener 80+.` : '');
    // Split at the student's answer so the expensive half can be cached. Students
    // submit at different moments inside the round window, so the first submission
    // writes the cache entry and the rest read it. Only the Anthropic judge needs the
    // two halves handed over separately (Claude has no implicit caching); OpenAI and
    // Gemini get them concatenated, byte-for-byte what they got before. See
    // ./lib/promptSplit for the invariant.
    const { prefix: systemPrefix, suffix: splitSuffix } = (0, promptSplit_1.splitPrompt)(judge.promptTemplate, fill, studentResponse);
    let systemSuffix = splitSuffix;
    // NOTA: aqui se inyectaban las clausulas de RuVerBench (strictJudgingClauses,
    // en ./lib/judgePromptClauses). Se retiraron el 2026-07-27 despues de medirlas.
    //
    // A/B estratificado sobre 60 respuestas reales (scripts/bt-judge-prompt-ab.ts
    // --stratify): 13 respuestas bajan, 0 suben, 22 movimientos de ancla y todos
    // hacia abajo. El efecto se concentra en la banda alta (Δ -8.5 en >= 80 contra
    // Δ -2.3 en < 60), con caidas de 87 a 60 sobre respuestas correctas.
    //
    // O sea: la clausula anti-expansion no produjo ningun efecto medible, y la de
    // anclaje estricto solo comprime el techo de la escala. El modulo y el harness
    // siguen en el repo por si se quieren retomar con otro diseno.
    // For non-ranked rounds, add signal extraction instructions
    if (!isRanked) {
        const scenarioId = scenario.id || '';
        const isFeria = scenarioId.includes('feria');
        const isEstilo = scenarioId.includes('estilo');
        if (isFeria) {
            // R4 "Feria Comprimida": implicit signal extraction from structured free text
            systemSuffix += `\n\nINSTRUCCIONES ADICIONALES PARA RONDA DIAGNOSTICA (FERIA):
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
            systemSuffix += `\n\nINSTRUCCIONES ADICIONALES PARA RONDA DIAGNOSTICA (ESTILO):
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
            systemSuffix += `\n\nINSTRUCCIONES ADICIONALES PARA RONDA DIAGNOSTICA:
Esta ronda NO afecta el ranking. Ademas de evaluar normalmente, debes extraer senales del estudiante.
Si la respuesta contiene un bloque [SENALES]...[/SENALES], parsea los valores estructurados dentro de ese bloque.
Campos esperados: PREFERENCIAS_FAMILIAS (3 numeros 1-6), SKILL_TECH/SKILL_DATOS/SKILL_SECTOR_PUBLICO/SKILL_ESCRITURA_PRESENTAR (1-5 cada uno), ROL_PREFERIDO (builder/owner/analyst/communicator), DISPONIBILIDAD_HORAS_SEMANA (numero), OUTPUT_PREFERIDO (reporte/chatbot/ambos).
Incluye en tu JSON de respuesta un campo adicional "parsedSignals" con los valores extraidos como objeto.
Si el bloque [SENALES] no existe o esta malformado, incluye "parsedSignals": null y agrega "extractionConfidence": 0.
Si el bloque existe y se parseo correctamente, agrega "extractionConfidence" entre 0.5 y 1.0 segun la calidad del parseo.
Manten tu respuesta concisa (max 120 palabras de feedback + bloque de senales).`;
        }
    }
    const provider = (0, judgeModels_1.resolveProvider)(judge);
    const model = (0, judgeModels_1.resolveModel)(judge);
    try {
        // Dispatch to whichever model backs this judge (OpenAI / Anthropic / Gemini).
        // Three DIFFERENT models decorrelate errors that three personas of one model
        // would share; the score is still computed in code from the returned anchors.
        const response = await (0, judgeModels_1.callJudgeModel)(clients, {
            provider,
            model,
            systemPrefix,
            systemSuffix,
            userPrompt: 'Evalua la respuesta del estudiante y responde SOLO con JSON valido.',
            maxTokens: isRanked ? 1200 : 1500,
        });
        // The score is COMPUTED from the judge's dimension anchors and the penalties it
        // reported — it is no longer whatever number the model chose to emit.
        const scored = (0, scoring_1.computeJudgeScore)(response.dimensionScores, response.penaltiesApplied, dimensionWeights, penaltyDefs);
        if (scored.unknownPenalties.length > 0) {
            console.warn(`Judge ${judge.judgeId} reported unknown penalty ids (ignored): ${scored.unknownPenalties.join(', ')}`);
        }
        // Legacy fallback: the ml2-2025 judges never emitted dimensionScores at all,
        // only a flat `score`. Honour it so those sessions keep working, but say so —
        // that path has none of the guarantees above (no anchors, no penalty audit,
        // arithmetic still done by the model).
        let score = scored.score;
        let failed = scored.failed;
        if (scored.failed) {
            const legacy = (0, parse_1.coerceScore)(response.score);
            if (Number.isFinite(legacy)) {
                console.warn(`Judge ${judge.judgeId}: no usable dimensionScores, falling back to legacy flat score`);
                score = Math.max(0, Math.min(100, legacy));
                failed = false;
            }
            else {
                console.error(`Judge ${judge.judgeId} (${provider}/${model}) returned no usable score:`, JSON.stringify(response).slice(0, 200));
            }
        }
        const evaluation = {
            judgeId: judge.judgeId,
            judgeName: judge.name,
            judgeAvatar: judge.avatar,
            score,
            failed,
            provider,
            model,
            dimensionScores: scored.dimensionScores,
            appliedPenalties: scored.appliedPenalties,
            feedback: response.feedback || 'Sin retroalimentacion',
            strengths: response.strengths || [],
            improvements: response.improvements || [],
            rawResponse: response,
            promptUsed: systemPrefix + systemSuffix,
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
        console.error(`Error with judge ${judge.judgeId} (${provider}/${model}):`, error);
        return {
            judgeId: judge.judgeId,
            judgeName: judge.name,
            judgeAvatar: judge.avatar,
            score: 0,
            failed: true,
            provider,
            model,
            feedback: 'Error en la evaluacion. Este juez no pudo evaluar la respuesta.',
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
    .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'],
})
    .https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { gameCode, round, submissionId } = data;
    if (!gameCode || round === undefined || !submissionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }
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
        // Resolve the judges first, then build only the provider clients they need.
        const activeJudges = judgeWeights
            .map((jw) => { var _a; return (_a = judgesConfig === null || judgesConfig === void 0 ? void 0 : judgesConfig.judges) === null || _a === void 0 ? void 0 : _a.find((j) => j.judgeId === jw.judgeId); })
            .filter((j) => {
            if (!j)
                console.warn(`Judge not found in config/judges`);
            return !!j;
        });
        const judgeOverrides = await loadJudgeOverrides(game.courseId);
        const mergedJudges = (0, judgeOverrides_1.applyJudgeOverrides)(activeJudges, judgeOverrides);
        const clients = await buildJudgeClients(mergedJudges);
        const evaluationPromises = mergedJudges.map((judge) => evaluateWithJudge(clients, judge, scenario, submission.response, sessionConfig, game.knowledgeBase || '', game.referenceDocs || '', isRanked));
        const evaluations = (await Promise.all(evaluationPromises)).filter(Boolean);
        const { finalScore, conceptsIdentified, failedJudges } = aggregateEvaluations(evaluations, judgeWeights);
        if (failedJudges.length > 0) {
            console.error(`Submission ${submissionId} scored with failed judges: ${failedJudges.join(', ')}`);
        }
        const evaluationResult = {
            finalScore,
            failedJudges,
            evaluations,
            conceptsIdentified,
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
    .runWith({
    timeoutSeconds: 300,
    memory: '1GB',
    secrets: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'],
})
    .https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { gameCode, round } = data;
    if (!gameCode || round === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing gameCode or round');
    }
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
        // Judges are constant across this round's submissions — resolve them and
        // build the provider clients once.
        const activeJudges = judgeWeights
            .map((jw) => { var _a; return (_a = judgesConfig === null || judgesConfig === void 0 ? void 0 : judgesConfig.judges) === null || _a === void 0 ? void 0 : _a.find((j) => j.judgeId === jw.judgeId); })
            .filter((j) => !!j);
        const judgeOverrides = await loadJudgeOverrides(game.courseId);
        const mergedJudges = (0, judgeOverrides_1.applyJudgeOverrides)(activeJudges, judgeOverrides);
        const clients = await buildJudgeClients(mergedJudges);
        for (const doc of unevaluatedDocs) {
            const submission = doc.data();
            const evaluationPromises = mergedJudges.map((judge) => evaluateWithJudge(clients, judge, scenario, submission.response, sessionConfig, game.knowledgeBase || '', game.referenceDocs || '', isRanked));
            const evaluations = (await Promise.all(evaluationPromises)).filter(Boolean);
            const { finalScore, conceptsIdentified, failedJudges } = aggregateEvaluations(evaluations, judgeWeights);
            if (failedJudges.length > 0) {
                console.error(`Submission ${doc.id} scored with failed judges: ${failedJudges.join(', ')}`);
            }
            await doc.ref.update({
                evaluation: {
                    finalScore,
                    failedJudges,
                    evaluations,
                    conceptsIdentified,
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
    var _a, _b, _c, _d, _e;
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
        // AI-generated scenarios carry their full case text in `prompt` instead of
        // separate `context`/`question` fields — fall back so duel comparisons still
        // get the case text for dynamic sessions.
        const scenarioContext = (_e = (_d = scenario === null || scenario === void 0 ? void 0 : scenario.context) !== null && _d !== void 0 ? _d : scenario === null || scenario === void 0 ? void 0 : scenario.prompt) !== null && _e !== void 0 ? _e : '';
        const context = [
            `TAREA: ${(scenario === null || scenario === void 0 ? void 0 : scenario.title) || ''}`,
            scenarioContext ? `CONTEXTO: ${scenarioContext}` : '',
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
            // Streaming the duel is cosmetic — never let a failed write abort the tournament.
            try {
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
            }
            catch (e) {
                console.error('duel stream write failed', e);
            }
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
            var _a, _b;
            const data = doc.data();
            const scenarioData = game.scenarios[data.round - 1];
            return {
                round: data.round,
                ranked: (scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.ranked) !== false,
                scenario: (scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.title) || `Ronda ${data.round}`,
                response: data.response,
                evaluation: data.evaluation,
                // Todo lo de abajo existe para la transcripcion del PDF del alumno: sin el
                // enunciado y sus propias respuestas, un reporte no le sirve para estudiar.
                type: (scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.type) === 'multiple_choice' ? 'multiple_choice' : 'open',
                // Los escenarios generados por IA traen el caso en `prompt` en vez de en
                // `context` — mismo fallback que usa recalibrateRound.
                context: (_b = (_a = scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.context) !== null && _a !== void 0 ? _a : scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.prompt) !== null && _b !== void 0 ? _b : '',
                question: typeof (scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.question) === 'string'
                    ? scenarioData.question
                    : (scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.question) ? JSON.stringify(scenarioData.question) : '',
                mcQuestions: ((scenarioData === null || scenarioData === void 0 ? void 0 : scenarioData.mcQuestions) || []).map((q) => ({
                    question: q.question,
                    options: (q.options || []).map((o) => ({ id: o.id, text: o.text })),
                    correctOptionIndex: q.correctOptionIndex,
                    explanation: q.explanation || '',
                })),
                mcResponses: data.mcResponses || [],
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
// =====================================
// GENERATE SESSION DRAFT (AI course builder)
// =====================================
const PLATFORM_ADMIN_EMAIL = 'naim.bro@gmail.com';
exports.generateSessionDraft = functions
    .region('us-central1')
    .runWith({ timeoutSeconds: 300, memory: '512MB', secrets: ['OPENAI_API_KEY'] })
    .https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const inputError = (0, sessionDraft_1.validateDraftInput)(data);
    if (inputError) {
        throw new functions.https.HttpsError('invalid-argument', inputError);
    }
    const input = data;
    // Only approved professors (or the admin) may burn OpenAI budget
    const callerEmail = context.auth.token.email || '';
    const isAdmin = callerEmail === PLATFORM_ADMIN_EMAIL && context.auth.token.email_verified === true;
    if (!isAdmin) {
        const profDoc = await db.collection('professors').doc(context.auth.uid).get();
        if (!profDoc.exists || profDoc.data().status !== 'approved') {
            throw new functions.https.HttpsError('permission-denied', 'Professor not approved');
        }
    }
    // Caller must own the course
    const courseDoc = await db.collection('courses').doc(input.courseId).get();
    if (!courseDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Course not found');
    }
    if (!isAdmin && courseDoc.data().professorId !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Not the course owner');
    }
    const openai = await getOpenAI();
    const prompt = (0, sessionDraft_1.buildGenerationPrompt)(input);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let draft = null;
    let lastError = '';
    for (let attempt = 0; attempt < 2 && !draft; attempt++) {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.7,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'user', content: prompt },
                ...(lastError
                    ? [{ role: 'user', content: `Tu intento anterior falló la validación: ${lastError}. Corrige y responde de nuevo SOLO con el JSON.` }]
                    : []),
            ],
        });
        try {
            const parsed = JSON.parse(((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '{}');
            const validationError = (0, sessionDraft_1.validateGeneratedDraft)(parsed, input);
            if (validationError) {
                lastError = validationError;
                console.warn(`generateSessionDraft attempt ${attempt + 1} invalid: ${validationError}`);
            }
            else {
                draft = parsed;
            }
        }
        catch (err) {
            lastError = 'JSON inválido';
            console.warn(`generateSessionDraft attempt ${attempt + 1} parse error:`, err);
        }
    }
    if (!draft) {
        throw new functions.https.HttpsError('internal', `La generación falló: ${lastError}. Intenta de nuevo.`);
    }
    // Server-authoritative fields (never trust the model for these)
    draft.config.roundCount = input.roundCount;
    draft.config.roundDurationSeconds = input.roundMinutes * 60;
    draft.config.title = input.title;
    const sessionRef = await db
        .collection('courses').doc(input.courseId)
        .collection('sessions').add({
        title: input.title,
        description: draft.config.description || '',
        status: 'draft',
        generatedBy: 'ai',
        config: draft.config,
        scenarios: draft.scenarios,
        rubric: draft.rubric,
        knowledgeBase: draft.knowledgeBase,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, sessionId: sessionRef.id };
});
//# sourceMappingURL=index.js.map