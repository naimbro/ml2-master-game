/**
 * Modelo de costos de Aula Maestra, parametrizado en N profesores x M alumnos x X sesiones.
 *
 * Todo lo que hay acá sale de medir el repo, no de estimar a ojo:
 *
 *  - El volumen de llamadas viene de `functions/src/index.ts`: 3 jueces por respuesta
 *    abierta (`evaluateWithJudge` x3), 2*(4n-10) duelos por ronda abierta
 *    (`RECAL_B = 4`, doble orden desde 2026-07-27), y CERO llamadas en rondas de
 *    alternativas (`index.ts:581` corta antes de los jueces, y `recalibrateRound`
 *    tampoco corre).
 *  - El tamaño del prompt del juez se midió sumando los componentes reales que
 *    `evaluateWithJudge` concatena (template + persona + KB + rúbrica + escenario +
 *    idealAnswer) sobre las sesiones `mundial_2026/final_2026` y `ml2-2025/session_3_rag`:
 *    20.8k-25.2k caracteres => ~6.0k-7.2k tokens. Uso 5.500 como central porque
 *    `selectKBSections` y `buildCompactRubric` recortan parte de eso en runtime.
 *  - El costo del duelo NO se estima: `bt-calibration.json` registra 1.455 llamadas
 *    por US$3,1891 => US$0,002192 por llamada con gpt-4o. De ahí se despeja el
 *    tamaño del prompt de duelo (~800 in / 20 out).
 *
 * Precios verificados el 2026-07-28 contra developers.openai.com/api/docs/pricing,
 * ai.google.dev/gemini-api/docs/pricing y la tabla de modelos de Anthropic.
 *
 * Correr:  npx tsx scripts/cost-model.ts
 */

type Price = { in: number; out: number; cachedIn?: number };

const PRICES: Record<string, Price> = {
  // OpenAI
  'gpt-5': { in: 1.25, out: 10.0, cachedIn: 0.125 },
  'gpt-5-mini': { in: 0.25, out: 2.0, cachedIn: 0.025 },
  'gpt-5-nano': { in: 0.05, out: 0.4, cachedIn: 0.005 },
  'gpt-4o': { in: 2.5, out: 10.0, cachedIn: 1.25 },
  'gpt-4o-mini': { in: 0.15, out: 0.6, cachedIn: 0.075 },
  // Google
  'gemini-2.5-pro': { in: 1.25, out: 10.0, cachedIn: 0.3125 },
  'gemini-2.5-flash': { in: 0.3, out: 2.5, cachedIn: 0.075 },
  'gemini-2.5-flash-lite': { in: 0.1, out: 0.4, cachedIn: 0.025 },
  // Anthropic (lista; sonnet-5 tiene precio introductorio 2/10 hasta 2026-08-31)
  'claude-sonnet-5': { in: 3.0, out: 15.0, cachedIn: 0.3 },
  'claude-haiku-4-5': { in: 1.0, out: 5.0, cachedIn: 0.1 },
};

/** Tokens medidos, no supuestos. Ver docstring. */
const JUDGE_IN = 5_500;
const JUDGE_OUT = 550;      // JSON del contrato nuevo (analysis + 3 anclas + listas + feedback)
const GEMINI_THINK = 128;   // GEMINI_THINKING_BUDGET, se factura como output
const GPT5_REASON = 150;    // reasoning_effort: 'minimal', se factura como output
const DUEL_IN = 800;
const DUEL_OUT = 20;

const M_ = 1e6;
const call = (m: string, tin: number, tout: number, cachedFrac = 0) => {
  const p = PRICES[m];
  const cached = tin * cachedFrac;
  const fresh = tin - cached;
  return (fresh * p.in + cached * (p.cachedIn ?? p.in) + tout * p.out) / M_;
};

/** Duelos por ronda abierta con n alumnos: doble orden sobre el schedule Swiss. */
const duelsPerRound = (n: number) => (n < 4 ? 0 : 2 * Math.max(0, 4 * n - 10));

type Panel = { openai: string; gemini: string; anthropic: string };
const PANELS: Record<string, Panel> = {
  actual: { openai: 'gpt-5', gemini: 'gemini-2.5-pro', anthropic: 'claude-sonnet-5' },
  'una banda abajo': { openai: 'gpt-5-mini', gemini: 'gemini-2.5-flash', anthropic: 'claude-haiku-4-5' },
  'piso absoluto': { openai: 'gpt-5-nano', gemini: 'gemini-2.5-flash-lite', anthropic: 'claude-haiku-4-5' },
};

const panelCost = (p: Panel, cachedFrac = 0) =>
  call(p.openai, JUDGE_IN, JUDGE_OUT + GPT5_REASON, cachedFrac) +
  call(p.gemini, JUDGE_IN, JUDGE_OUT + GEMINI_THINK, cachedFrac) +
  call(p.anthropic, JUDGE_IN, JUDGE_OUT, cachedFrac);

// ---------------------------------------------------------------- panel
console.log('\n=== COSTO POR RESPUESTA ABIERTA (panel de 3 jueces) ===');
console.log('panel                sin caché   con caché de prefijo (85%)');
for (const [name, p] of Object.entries(PANELS)) {
  const a = panelCost(p, 0), b = panelCost(p, 0.85);
  console.log(`${name.padEnd(20)} $${a.toFixed(4)}     $${b.toFixed(4)}   (-${((1 - b / a) * 100).toFixed(0)}%)`);
}

console.log('\n  desglose del panel actual, por juez:');
for (const [prov, m, extra] of [
  ['openai', 'gpt-5', GPT5_REASON],
  ['gemini', 'gemini-2.5-pro', GEMINI_THINK],
  ['anthropic', 'claude-sonnet-5', 0],
] as [string, string, number][]) {
  const sin = call(m, JUDGE_IN, JUDGE_OUT + extra, 0);
  const con = call(m, JUDGE_IN, JUDGE_OUT + extra, 0.85);
  console.log(`    ${prov.padEnd(10)} ${m.padEnd(18)} $${sin.toFixed(4)} -> $${con.toFixed(4)}`);
}

// ---------------------------------------------------------------- duelos
console.log('\n=== COSTO DE DUELOS POR RONDA ABIERTA (n = alumnos) ===');
console.log('modelo             $/llamada    n=15      n=25      n=35     $/alumno');
for (const m of ['gpt-4o', 'gpt-5-mini', 'gpt-4o-mini', 'gpt-5-nano']) {
  const per = call(m, DUEL_IN, DUEL_OUT);
  const row = [15, 25, 35].map((n) => `$${(duelsPerRound(n) * per).toFixed(3)}`);
  const perStudent = (duelsPerRound(25) * per) / 25;
  console.log(
    `${m.padEnd(18)} $${per.toFixed(5)}   ${row.map((r) => r.padEnd(9)).join('')} $${perStudent.toFixed(4)}`
  );
}

// ---------------------------------------------------------------- semestre
type Scenario = { name: string; profs: number; students: number; sessions: number; open: number };
const SCENARIOS: Scenario[] = [
  { name: 'conservador  (3 profes)', profs: 3, students: 25, sessions: 8, open: 2 },
  { name: 'base        (10 profes)', profs: 10, students: 30, sessions: 10, open: 2 },
  { name: 'optimista   (25 profes)', profs: 25, students: 35, sessions: 12, open: 2 },
];

const semester = (s: Scenario, panel: Panel, duelModel: string, cachedFrac: number) => {
  const games = s.profs * s.sessions;
  const judges = games * s.open * s.students * panelCost(panel, cachedFrac);
  const duels = games * s.open * duelsPerRound(s.students) * call(duelModel, DUEL_IN, DUEL_OUT);
  return { games, judges, duels, total: judges + duels };
};

for (const openRounds of [2, 6]) {
  console.log(`\n=== SEMESTRE COMPLETO — ${openRounds} rondas abiertas por sesión ===`);
  console.log('escenario                 juegos   HOY      +caché   +duelos 5-mini   panel banda abajo');
  for (const base of SCENARIOS) {
    const s = { ...base, open: openRounds };
    const hoy = semester(s, PANELS.actual, 'gpt-4o', 0);
    const cache = semester(s, PANELS.actual, 'gpt-4o', 0.85);
    const duel = semester(s, PANELS.actual, 'gpt-5-mini', 0.85);
    const band = semester(s, PANELS['una banda abajo'], 'gpt-5-mini', 0.85);
    console.log(
      `${s.name.padEnd(24)} ${String(hoy.games).padStart(5)}   ` +
        [hoy, cache, duel, band]
          .map((r) => `$${r.total.toFixed(0)}`.padEnd(9))
          .join('')
    );
  }
}

console.log('\n=== DE DÓNDE SALE LA PLATA (escenario base, 2 abiertas, hoy) ===');
const b = semester({ ...SCENARIOS[1], open: 2 }, PANELS.actual, 'gpt-4o', 0);
console.log(`  jueces: $${b.judges.toFixed(0)}  (${((b.judges / b.total) * 100).toFixed(0)}%)`);
console.log(`  duelos: $${b.duels.toFixed(0)}  (${((b.duels / b.total) * 100).toFixed(0)}%)`);
console.log(`  Los duelos hacen ~7 llamadas por alumno contra 3 de los jueces,`);
console.log(`  pero cada duelo son 820 tokens y cada juez ~6.050. La cuenta la manda el juez.\n`);
