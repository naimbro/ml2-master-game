#!/usr/bin/env node
/**
 * One-shot scaffolder for IA y Democracia 2026 placeholder units.
 *
 * Genera config.json, scenarios.json, rubric.json y knowledge_base.md
 * para cada unidad del curso (excepto unidad_00_demo que ya existe
 * como sesion funcional). Solo escribe archivos que NO existan, asi
 * que se puede correr varias veces sin sobrescribir contenido real
 * que ya hayas escrito.
 *
 * Uso:
 *   node scripts/scaffold-ai-democracy-units.js
 *
 * Para regenerar un placeholder despues de borrarlo, simplemente
 * borra la carpeta de la unidad y vuelve a correr el script.
 */

const fs = require('fs');
const path = require('path');

const COURSE_ROOT = path.join(
  __dirname, '..', 'content', 'sessions', 'ai_democracy_2026'
);

const UNITS = [
  {
    folder: 'unidad_01_backlash',
    title: 'Unidad 1: Diagnostico — Un backlash contra la IA?',
    description: 'Diagnostico inicial: hay un backlash real contra la IA o es panico moral? Quien lo articula y a quien beneficia la narrativa?',
    date: '2026-08-15',
    conceptTags: ['backlash', 'actores_y_asimetrias', 'panico_moral', 'diagnostico_inicial'],
    placeholderQuestion: 'Hay un backlash real contra la IA?',
    placeholderJudgeFocus: 'Distingue critica organica de panico moral. Identifica intereses tras la narrativa.',
  },
  {
    folder: 'unidad_02_populismo_ia',
    title: 'Unidad 2: Amenazas — Populismo de IA: quien controla la tecnologia?',
    description: 'Concentracion de poder en empresas de IA, captura tecnologica del Estado, y efectos sobre soberania democratica.',
    date: '2026-08-29',
    conceptTags: ['concentracion_de_poder', 'soberania_tecnologica', 'captura_estatal', 'oligopolio_ia'],
    placeholderQuestion: 'Como afecta la concentracion en pocas empresas a la soberania democratica?',
    placeholderJudgeFocus: 'Identifica asimetrias entre empresas de IA y estados. Reconoce mecanismos de captura.',
  },
  {
    folder: 'unidad_03_sociedad_bots',
    title: 'Unidad 3: Amenazas — Una sociedad de bots IA',
    description: 'Saturacion del espacio publico por contenido generado: efectos sobre deliberacion, autenticidad, y formacion de opinion.',
    date: '2026-09-12',
    conceptTags: ['saturacion_informativa', 'autenticidad', 'esfera_publica', 'astroturfing'],
    placeholderQuestion: 'Como cambia el espacio publico cuando la mayoria del contenido es generado por IA?',
    placeholderJudgeFocus: 'Distingue cantidad de informacion de calidad deliberativa. Identifica afectados sin voz en el espacio publico saturado.',
  },
  {
    folder: 'unidad_04_orwell',
    title: 'Unidad 4: Amenazas — La IA en una sociedad orwelliana',
    description: 'Vigilancia masiva, scoring social, predictive policing. La IA como herramienta de control biopolitico.',
    date: '2026-09-26',
    conceptTags: ['vigilancia_masiva', 'scoring_social', 'predictive_policing', 'biopolitica'],
    placeholderQuestion: 'Donde esta la frontera entre seguridad legitima y vigilancia autoritaria?',
    placeholderJudgeFocus: 'Identifica el dilema entre seguridad y libertades. Penaliza autoritarismo eficiente.',
  },
  {
    folder: 'unidad_05_democracia_deliberativa',
    title: 'Unidad 5: Respuestas — IA generativa y democracia deliberativa',
    description: 'IA como facilitadora de procesos deliberativos: asambleas ciudadanas, sintesis de opinion, traduccion entre publicos. Riesgos y oportunidades.',
    date: '2026-10-10',
    conceptTags: ['democracia_deliberativa', 'asambleas_ciudadanas', 'sintesis_argumental', 'forma_de_participacion'],
    placeholderQuestion: 'Bajo que condiciones la IA generativa fortalece la deliberacion democratica?',
    placeholderJudgeFocus: 'Distingue consulta de deliberacion. Identifica riesgos de mediacion tecnologica de la voluntad popular.',
  },
  {
    folder: 'unidad_06_regulacion',
    title: 'Unidad 6: Respuestas — Regulacion de la IA',
    description: 'Modelos regulatorios: AI Act europeo, enfoque sectorial estadounidense, marcos voluntarios, sandbox. Legitimidad, eficacia y riesgos de captura.',
    date: '2026-10-24',
    conceptTags: ['regulacion_ia', 'ai_act', 'sandbox_regulatorio', 'instrumento_regulatorio'],
    placeholderQuestion: 'Que modelo regulatorio es legitimo y operativo para el contexto chileno?',
    placeholderJudgeFocus: 'Evalua la proporcionalidad del instrumento regulatorio al riesgo. Identifica riesgo de captura.',
  },
];

const SHARED_JUDGES = [
  { judgeId: 'democracy_scholar', weight: 0.40 },
  { judgeId: 'policy_lawyer', weight: 0.30 },
  { judgeId: 'professor_twin_ayd', weight: 0.30 },
];

const SHARED_JUDGE_CONFIG = {
  democracy_scholar: {
    sessionLens: 'TODO: ajustar al foco final de la unidad. Por defecto: foco en si el estudiante identifica la tension democratica concreta y distingue legalidad de legitimidad.',
    weightFormula: 'score = 0.50 * process_structuring + 0.30 * institutional_realism + 0.20 * precision_clarity',
  },
  policy_lawyer: {
    sessionLens: 'TODO: ajustar al foco final. Por defecto: foco en mecanismos de rendicion de cuentas operacionales y mapeo de actores con potestad concreta vs afectados sin voz.',
    weightFormula: 'score = 0.20 * process_structuring + 0.65 * institutional_realism + 0.15 * precision_clarity',
  },
  professor_twin_ayd: {
    sessionLens: 'TODO: ajustar al foco final. Por defecto: foco en uso de tags solicitados, claridad y capacidad de tomar posicion bajo incertidumbre.',
    weightFormula: 'score = 0.30 * process_structuring + 0.30 * institutional_realism + 0.40 * precision_clarity',
  },
};

function buildConfig(unit) {
  return {
    _TODO: 'Sesion en construccion. Reemplazar este config y los demas archivos antes de la primera clase de la unidad.',
    sessionId: unit.folder,
    title: unit.title,
    description: unit.description + ' Por completar.',
    date: unit.date,
    roundCount: 1,
    roundDurationSeconds: 240,
    bufferSeconds: 90,
    conceptTags: unit.conceptTags,
    judges: SHARED_JUDGES,
    judgeConfig: SHARED_JUDGE_CONFIG,
  };
}

function buildScenarios(unit) {
  const id = unit.folder.replace(/^unidad_/, 'u') + '_placeholder_01';
  return [
    {
      _TODO: 'Escenario placeholder. Reemplazar antes de la clase. Mantener estructura de campos.',
      id: id.replace(/_/g, '_').toLowerCase().substring(0, 40),
      order: 1,
      title: '[PLACEHOLDER] ' + unit.placeholderQuestion,
      category: 'Por definir',
      difficulty: 'medium',
      ranked: true,
      durationSeconds: 240,
      requiredTags: ['ACTOR_AFECTADO', 'ASIMETRIA_DE_PODER', 'MECANISMO_RENDICION_CUENTAS'],
      judgeFocus: unit.placeholderJudgeFocus + ' (PLACEHOLDER — ajustar al escenario final.)',
      context: 'TODO: reemplazar por una vineta concreta y especifica al tema de la unidad. Una buena vineta es: caso, decision en juego, actor con potestad, plazo. NO usar generalidades.',
      question: 'Responde con los siguientes tags (placeholder, ajustar al contenido final):\n\n[ACTOR_AFECTADO] Identifica al menos 2 actores afectados, incluyendo uno sin voz organizada.\n[ASIMETRIA_DE_PODER] Identifica una asimetria de poder no obvia presente en el caso.\n[MECANISMO_RENDICION_CUENTAS] Propon mecanismo concreto: quien rinde, ante quien, cuando, con que consecuencia.\n\nMaximo 12 lineas.',
      conceptTags: unit.conceptTags.slice(0, 2),
      referenceAnswer: 'TODO: completar con respuesta de referencia que ejemplifique nivel ~80. Servira al juez para calibrar la extension y el detalle esperados.',
      idealAnswer: {
        keyPoints: [
          'TODO: punto clave 1',
          'TODO: punto clave 2',
          'TODO: punto clave 3',
        ],
        expectedConcepts: ['TODO_concepto_1', 'TODO_concepto_2'],
        commonMistakes: [
          'TODO: error tipico 1',
          'TODO: error tipico 2',
        ],
        excellentResponseIndicators: [
          'TODO: indicador de excelencia 1',
          'TODO: indicador de excelencia 2',
        ],
      },
    },
  ];
}

function buildRubric(unit) {
  return {
    _TODO: 'Rubrica placeholder. Es una copia de _shared/base_rubric.json con sessionId actualizado. Si quieres ajustar pesos o criterios para esta unidad especifica, hazlo aqui sin tocar _shared/.',
    sessionId: unit.folder,
    globalInstructions: `Evalua SOLO lo que esta escrito. Curso 'IA y Democracia' (UAI Minor IA, 2026), Unidad: ${unit.title}. Premia identificacion de tensiones democraticas concretas, mapeo de actores con asimetrias, y mecanismos operacionales. Penaliza solucionismo, neutralidad ingenua, y accountability decorativa. Usa 'judgeFocus' del escenario como ancla principal.`,
    scoring: {
      scaleLevels: [100, 80, 60, 40, 20, 0],
      instructions: 'Respuestas concretas con tags solicitados pesan mas que respuestas largas y vagas.',
    },
    dimensions: [
      {
        id: 'process_structuring',
        name: 'Identificacion del Dilema Democratico y Diseno Institucional',
        weight: 0.45,
        description: 'Capacidad de nombrar la tension democratica concreta, distinguir legalidad de legitimidad, identificar dilema entre derechos, y proponer diseno con compromisos asumidos.',
        level_100: 'Nombra explicitamente la tension democratica concreta. Distingue derechos en juego. Propone diseno con compromisos asumidos. Reconoce que el dilema no se resuelve en un paso.',
        level_80: 'Identifica la tension pero deja un elemento parcialmente vago.',
        level_60: 'Hay intencion pero queda formulada como problema tecnico o dilema generico.',
        level_40: 'Habla del tema pero no llega a nombrar la tension.',
        level_20: 'Respuesta tecnologica que ignora la dimension democratica.',
        level_0: 'No responde o texto irrelevante.',
      },
      {
        id: 'institutional_realism',
        name: 'Mapeo de Actores, Asimetrias y Mecanismo de Rendicion de Cuentas',
        weight: 0.35,
        description: 'Identifica quien decide, quien se ve afectado (especialmente sin voz), asimetrias de poder, y mecanismos concretos de rendicion de cuentas.',
        level_100: 'Actor decisor con potestad concreta + afectado sin voz organizada. Asimetria no obvia. Mecanismo con quien-ante-quien-cuando-consecuencia. Reconoce riesgo de captura.',
        level_80: 'Casi todo presente, un elemento incompleto.',
        level_60: 'Actores formulados como abstracciones. Accountability decorativa.',
        level_40: 'Casi no considera actores ni mecanismos.',
        level_20: 'Trata el problema sin actores con intereses divergentes.',
        level_0: 'No responde o texto irrelevante.',
      },
      {
        id: 'precision_clarity',
        name: 'Claridad, Estructura, Uso de Tags y Anti-vaguedad',
        weight: 0.20,
        description: 'Concrecion, uso de tags, posicion clara, sin falsa precision.',
        level_100: 'Lenguaje concreto. Tags literales. Cabe en limite de lineas. Toma posicion. No inventa datos.',
        level_80: 'Mayormente claro; 1-2 frases vagas o tag faltante.',
        level_60: 'Mezcla claridad con vaguedad. Tags parcialmente usados.',
        level_40: 'Prosa amplia o confusa. Tags ausentes.',
        level_20: 'Puro humo. Generica.',
        level_0: 'No responde o texto irrelevante.',
      },
    ],
    globalPenalties: [
      'Solucionismo tecnologico: si propone IA como si por si sola resolviera el problema, sin actor ni mecanismo, no puede superar 60 en Identificacion del Dilema ni en Mapeo de Actores.',
      'Neutralidad tecnica ingenua: si trata la IA como neutral sin valores ni sesgos, no puede superar 60 en Mapeo de Actores.',
      'Legalidad equivale a legitimidad: si asume legitimidad por legalidad, no puede superar 60 en Identificacion del Dilema.',
      'Ignorar afectados no presentes: si no considera grupos vulnerables o sin voz, no puede superar 60 en Mapeo de Actores.',
      'Falsa precision: si inventa cifras o capacidades no entregadas, baja 20 en Claridad y no puede superar 60 en Mapeo de Actores.',
      'Autoritarismo eficiente: si justifica vigilancia o coercion solo por eficiencia, no puede superar 60 en Identificacion del Dilema ni en Mapeo de Actores.',
      'Accountability decorativa: transparencia sin quien-ante-quien-cuando-consecuencia, no puede superar 60 en Mapeo de Actores.',
      'Tags solicitados ausentes: si requiredTags no aparecen literalmente, baja Claridad.',
    ],
    bonusIndicators: [
      'Identifica asimetria no obvia.',
      'Distingue legalidad de legitimidad sin pedirselo.',
      'Nombra actor sin voz y propone representacion.',
      'Hace explicito un supuesto critico.',
      'Mecanismo de accountability con los 4 elementos.',
      'Reconoce riesgo de captura concreto.',
      'Compara contra contrafactual.',
      'Reconoce trade-offs entre derechos.',
    ],
    penaltyIndicators: [
      'Salta a solucion tecnica sin nombrar tension.',
      'Trata "la sociedad" como agente unitario.',
      'Metricas tecnicas para problemas politicos.',
      'Confunde anonimato con privacidad o transparencia con accountability.',
      'Citas como ornamento sin argumentacion.',
    ],
  };
}

function buildKnowledgeBase(unit) {
  return `# ${unit.title} — Base de Conocimiento (PLACEHOLDER)

Este es un esqueleto de la base de conocimiento de la unidad. Completar
antes de la clase. El motor secciona la KB con marcadores
\`<!-- section: tag1, tag2 -->\` para entregar al juez solo las secciones
relevantes a los \`conceptTags\` del escenario en curso. Las secciones
marcadas \`_always\` se incluyen siempre.

---

<!-- section: _always -->
## Marco general del curso

Este es el curso **IA y Democracia** del Minor en IA de la Universidad
Adolfo Ibanez, edicion 2026. La pregunta operacional no es "es buena o
mala la IA?" sino "que diseno institucional permite gobernarla
legitimamente?".

El juez NO premia conformidad ideologica. Premia identificar tensiones
reales, mapear actores con potestad y actores sin voz, distinguir
legalidad de legitimidad, proponer mecanismos operacionales (no
decorativos), y ser honesto sobre supuestos.

---

<!-- section: ${unit.conceptTags.join(', ')} -->
## ${unit.title.replace(/^Unidad \d+: /, '')}

### Pregunta orientadora
TODO: cual es la pregunta operacional que articula la unidad?

### Tension central
TODO: cual es la tension irreducible que no se resuelve con un solo
principio? Identificar al menos dos polos en tension.

### Actores y asimetrias
TODO: quienes son los actores con potestad sobre las decisiones
relevantes en la unidad? Quienes son los afectados sin voz? Que
asimetrias estructurales sostienen el problema?

### Conceptos clave
TODO: 4-6 conceptos que el juez debe poder reconocer. Para cada
concepto: definicion breve + ejemplo concreto.

- Concepto 1: ...
- Concepto 2: ...
- Concepto 3: ...

### Errores tipicos a penalizar
TODO: que errores especificos del razonamiento esperamos en esta
unidad? (Ej: confundir consulta con deliberacion, asumir neutralidad
tecnica, etc.)

### Lecturas y fuentes (opcional)
TODO: si los estudiantes leyeron algo especifico para esta unidad,
listalo aqui (autor, idea principal, una linea). El juez no leyo el
texto pero usa estos resumenes para chequear coherencia con lo visto
en clase.

---

## TODO general para esta unidad

- [ ] Reemplazar el escenario placeholder en \`scenarios.json\` por
      escenarios reales (idealmente 2-3 rondas).
- [ ] Ajustar \`config.json\`: \`roundCount\`, \`date\` real,
      \`conceptTags\` definitivos, \`sessionLens\` por juez.
- [ ] Completar este \`knowledge_base.md\` con conceptos y ejemplos.
- [ ] Calibrar la rubrica con 2-3 respuestas sinteticas (una buena, una
      regular, una solucionista) antes de usar en clase.
- [ ] Verificar con \`node scripts/validate-content.js\` que la sesion
      pasa validacion.
`;
}

function writeIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) {
    console.log(`  SKIP (exists): ${path.relative(process.cwd(), filePath)}`);
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`  WROTE: ${path.relative(process.cwd(), filePath)}`);
  return true;
}

function scaffoldUnit(unit) {
  console.log(`\n[${unit.folder}]`);
  const dir = path.join(COURSE_ROOT, unit.folder);
  writeIfMissing(
    path.join(dir, 'config.json'),
    JSON.stringify(buildConfig(unit), null, 2) + '\n',
  );
  writeIfMissing(
    path.join(dir, 'scenarios.json'),
    JSON.stringify(buildScenarios(unit), null, 2) + '\n',
  );
  writeIfMissing(
    path.join(dir, 'rubric.json'),
    JSON.stringify(buildRubric(unit), null, 2) + '\n',
  );
  writeIfMissing(
    path.join(dir, 'knowledge_base.md'),
    buildKnowledgeBase(unit),
  );
}

function main() {
  if (!fs.existsSync(COURSE_ROOT)) {
    console.error(`Course root not found: ${COURSE_ROOT}`);
    process.exit(1);
  }
  console.log(`Scaffolding placeholder units in ${COURSE_ROOT}`);
  console.log(`(skipping any file that already exists)\n`);
  for (const unit of UNITS) {
    scaffoldUnit(unit);
  }
  console.log('\nDone. Run `node scripts/validate-content.js ai_democracy_2026` to verify.');
}

main();
