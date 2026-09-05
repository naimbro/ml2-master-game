// Input validation, output validation and prompt construction for the
// AI session-draft generator. Pure functions (no firebase/openai imports)
// so they are unit-testable.

export interface SessionDraftInput {
  courseId: string;
  title: string;
  topicDescription: string;
  audience: string;
  roundCount: number;
  roundMinutes: number;
  language: string;
}

// El panel generico (content/courses/_generic/judges.json). El asistente IA lo usa
// para CUALQUIER curso: antes referenciaba los jueces de ml2-2025, asi que toda
// sesion creada por otro profesor nacia con el panel de Naim.
export const ALLOWED_JUDGES = ['generic_specialist', 'generic_praxis', 'generic_teacher'];

export function validateDraftInput(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'Datos inválidos';
  const d = data as Partial<SessionDraftInput>;
  if (!d.courseId || typeof d.courseId !== 'string') return 'Falta courseId';
  if (!d.title || !d.title.trim()) return 'Falta el título de la sesión';
  if (!d.topicDescription || d.topicDescription.trim().length < 30) {
    return 'Describe el tema de la sesión en al menos 30 caracteres';
  }
  if (!d.audience || !d.audience.trim()) return 'Falta la audiencia';
  if (!Number.isInteger(d.roundCount) || (d.roundCount as number) < 2 || (d.roundCount as number) > 6) {
    return 'El número de rondas debe ser entre 2 y 6';
  }
  if (!Number.isInteger(d.roundMinutes) || (d.roundMinutes as number) < 2 || (d.roundMinutes as number) > 15) {
    return 'Los minutos por ronda deben ser entre 2 y 15';
  }
  if (!d.language || !d.language.trim()) return 'Falta el idioma';
  return null;
}

const esTextoUtil = (x: unknown): boolean => typeof x === 'string' && x.trim().length > 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateGeneratedDraft(draft: any, input: SessionDraftInput): string | null {
  if (!draft || typeof draft !== 'object') return 'El borrador generado no es un objeto';
  const { config, scenarios, rubric, knowledgeBase } = draft;

  if (!config || typeof config !== 'object') return 'Falta config';

  if (!Array.isArray(scenarios) || scenarios.length !== input.roundCount) {
    return `Se esperaban ${input.roundCount} escenarios, llegaron ${Array.isArray(scenarios) ? scenarios.length : 0}`;
  }
  for (const s of scenarios) {
    if (!s?.id || !s?.title || !s?.prompt) return 'Cada escenario necesita id, title y prompt';

    // La respuesta ideal y la guia son la mitad que ancla al juez a ESTA pregunta;
    // la rubrica solo trae la escala. Sin ellas la sesion se publica igual y el
    // sintoma aparece semanas despues, en puntajes que no separan a nadie.
    // El piso es bajo a proposito: pilla el campo ausente y el "N/A", nada mas.
    if (!esTextoUtil(s.idealAnswer) || s.idealAnswer.trim().length < 80) {
      return `El escenario '${s.id}' necesita idealAnswer: 3-5 frases con lo que contestaría un alumno de 80 puntos`;
    }
    const guia = s.evaluationGuide;
    if (!guia || typeof guia !== 'object') {
      return `El escenario '${s.id}' necesita evaluationGuide: { "must_hit": string[], "fatal_errors": string[] }, con al menos un elemento en cada lista`;
    }
    if (!Array.isArray(guia.must_hit) || !guia.must_hit.some(esTextoUtil)) {
      return `El escenario '${s.id}' necesita al menos un must_hit en evaluationGuide`;
    }
    if (!Array.isArray(guia.fatal_errors) || !guia.fatal_errors.some(esTextoUtil)) {
      return `El escenario '${s.id}' necesita al menos un fatal_errors en evaluationGuide`;
    }
  }

  if (!rubric || !Array.isArray(rubric.dimensions) || rubric.dimensions.length < 2) {
    return 'La rúbrica necesita al menos 2 dimensiones';
  }
  const LEVELS = ['level_100', 'level_80', 'level_60', 'level_40', 'level_20', 'level_0'];
  let weightSum = 0;
  for (const dim of rubric.dimensions) {
    if (!dim?.id || !dim?.name || typeof dim?.weight !== 'number') {
      return 'Cada dimensión necesita id, name y weight numérico';
    }
    weightSum += dim.weight;
    for (const level of LEVELS) {
      if (typeof dim[level] !== 'string' || !dim[level]) return `Falta el nivel ${level} en la dimensión ${dim.id}`;
    }
  }
  if (Math.abs(weightSum - 1) > 0.01) return `Los pesos de las dimensiones suman ${weightSum.toFixed(2)}, deben sumar 1`;

  if (!Array.isArray(config.judges) || config.judges.length === 0) return 'Faltan jueces en config';
  for (const j of config.judges) {
    if (!ALLOWED_JUDGES.includes(j?.judgeId)) {
      return `Jueces inválidos: solo se permiten ${ALLOWED_JUDGES.join(', ')}`;
    }
  }

  const judgeConfig = config.judgeConfig;
  if (!judgeConfig || typeof judgeConfig !== 'object') return 'Falta judgeConfig en config';
  for (const j of config.judges) {
    const jc = judgeConfig[j.judgeId];
    if (!jc || typeof jc.sessionLens !== 'string' || jc.sessionLens.trim().length < 20) {
      return `Falta sessionLens (mínimo 20 caracteres) en judgeConfig para el juez ${j.judgeId}`;
    }
    if (typeof jc.weightFormula !== 'string' || !jc.weightFormula.includes('score')) {
      return `Falta weightFormula válida en judgeConfig para el juez ${j.judgeId}`;
    }
  }

  if (typeof knowledgeBase !== 'string' || knowledgeBase.length < 500) {
    return 'La knowledge base es muy corta (mínimo 500 caracteres)';
  }
  return null;
}

export function buildGenerationPrompt(input: SessionDraftInput): string {
  const dimensionExample = `{
      "id": "identificador_snake_case",
      "name": "Nombre de la dimensión",
      "weight": 0.35,
      "description": "Qué evalúa esta dimensión",
      "level_100": "Descripción de una respuesta excelente",
      "level_80": "Descripción de una respuesta muy buena",
      "level_60": "Descripción de una respuesta aceptable",
      "level_40": "Descripción de una respuesta débil",
      "level_20": "Descripción de una respuesta muy débil",
      "level_0": "No responde o texto irrelevante"
    }`;

  return `Eres un diseñador instruccional experto en juegos educativos competitivos con evaluación por IA.

Diseña una sesión de juego para la plataforma ML2. Los estudiantes responden por escrito, bajo presión de tiempo, a escenarios desafiantes; tres jueces IA evalúan cada respuesta con una rúbrica.

DATOS DE LA SESIÓN:
- Título: ${input.title}
- Tema: ${input.topicDescription}
- Audiencia: ${input.audience}
- Número de rondas: ${input.roundCount}
- Minutos por ronda: ${input.roundMinutes}
- Idioma de todo el contenido: ${input.language}

PRINCIPIOS DE DISEÑO (síguelos estrictamente):
1. Cada escenario plantea un caso concreto con tensión real y pide una decisión o análisis específico, NO una pregunta de definición.
2. Los escenarios exigen tomar posición: elegir UNA opción y justificarla vale más que enumerar consideraciones.
3. La rúbrica premia especificidad, realismo y estructura; penaliza respuestas genéricas, listas sin posición y soluciones mágicas.
4. La knowledge base entrega el contexto mínimo que un estudiante necesita para responder bien (conceptos clave, datos del caso, definiciones) en 800-1500 palabras, formato markdown.
5. La dificultad crece levemente entre rondas.
6. Escribes la knowledge base PRIMERO y todo lo demás sale de ella. La respuesta ideal de cada ronda es lo que un alumno que leyó ese material podría efectivamente contestar.

RESPONDE SOLO CON UN JSON VÁLIDO con esta estructura EXACTA, y en ESTE ORDEN de claves:
{
  "knowledgeBase": "# Título\\n\\nContenido markdown de 800-1500 palabras...",
  "config": {
    "title": "${input.title}",
    "description": "Descripción de 1-2 líneas de la sesión",
    "roundCount": ${input.roundCount},
    "roundDurationSeconds": ${input.roundMinutes * 60},
    "bufferSeconds": 60,
    "conceptTags": ["3 a 6 tags en snake_case de los conceptos de la sesión"],
    "judges": [
      { "judgeId": "generic_specialist", "weight": 0.35 },
      { "judgeId": "generic_praxis", "weight": 0.35 },
      { "judgeId": "generic_teacher", "weight": 0.30 }
    ],
    "judgeConfig": {
      "generic_specialist": { "sessionLens": "Instrucción de 2-4 frases que le dice a este juez qué premiar y qué penalizar EN ESTA SESIÓN, adaptada al tema", "weightFormula": "score = <pesos> usando los ids de las dimensiones de la rúbrica, ej: score = 0.40 * dim_a + 0.35 * dim_b + 0.25 * dim_c" },
      "generic_praxis": { "sessionLens": "...", "weightFormula": "..." },
      "generic_teacher": { "sessionLens": "...", "weightFormula": "..." }
    }
  },
  "scenarios": [
    {
      "id": "r1_identificador",
      "title": "Título corto de la ronda",
      "prompt": "El escenario completo que ve el estudiante: contexto del caso (3-6 frases) + tarea específica con instrucciones de formato si aplica",
      "judgeFocus": "1-2 frases: qué deben priorizar los jueces al evaluar esta ronda",
      "idealAnswer": "3-5 frases EN PROSA con lo que contestaría un alumno de 80 puntos a ESTA ronda. Escríbela como la escribiría el alumno, no como una lista de requisitos: es la calibración de largo y de tono para los jueces.",
      "evaluationGuide": {
        "must_hit": ["2-3 cosas que una buena respuesta no puede dejar de decir"],
        "fatal_errors": ["2-3 errores que hunden la respuesta aunque esté bien escrita"]
      },
      "ranked": true
    }
  ],
  "rubric": {
    "globalInstructions": "Instrucciones globales para los jueces: qué premiar, qué penalizar, en 3-6 frases",
    "scoring": {
      "scaleLevels": [100, 80, 60, 40, 20, 0],
      "instructions": "Evalúa SOLO lo que está escrito."
    },
    "dimensions": [
      ${dimensionExample}
    ]
  }
}

REGLAS DURAS:
- Exactamente ${input.roundCount} escenarios.
- Exactamente 3 dimensiones en la rúbrica, con pesos que suman 1.0.
- Los weightFormula usan los MISMOS ids de las dimensiones.
- judges usa SOLO los judgeIds generic_specialist (rigor conceptual), generic_praxis
  (aplicabilidad y restricciones reales) y generic_teacher (comprension y claridad).
  Los sessionLens deben respetar ese reparto de lentes, no repetirse entre si.
- La respuesta ideal y los errores fatales SOLO pueden usar hechos que esten en la
  knowledgeBase que escribiste. Si un hecho no esta ahi, no lo menciones: cambia la
  respuesta ideal, no agregues el hecho. Nada de cifras, estudios ni porcentajes
  inventados.
- Todo el texto en ${input.language}.`;
}
