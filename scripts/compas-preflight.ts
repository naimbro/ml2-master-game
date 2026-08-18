/**
 * El chequeo que faltaba: responder el compas como personas-tipo consistentes
 * y ver si el instrumento las separa.
 *
 *   npx tsx scripts/compas-preflight.ts mgt300_2026
 *
 * Por que existe. La aplicacion 1 de ai_democracy_2026 (21 alumnos, 17-ago-2026)
 * salio con alfa de Cronbach 0.01 en magnitud y 0.12 en direccion, y con una
 * correlacion mitad-mitad de 0.03 y 0.08 sobre las 126 y 252 particiones
 * posibles. El instrumento no media una posicion estable, y eso no se supo
 * hasta despues de jugarlo con un curso entero. Ningun chequeo estructural lo
 * habria visto: los tests de `compasContent.test.ts` pasaban todos.
 *
 * Lo que este script SI puede decir antes de una sala: si los extremos de cada
 * item son el mismo tipo de persona. Las personas de abajo eligen leyendo el
 * TEXTO de cada opcion, no su vector — esa es toda la gracia. Si una persona
 * coherente elige por texto y aterriza donde no corresponde, el vector no dice
 * lo que dice la opcion.
 *
 * Lo que NO puede decir: como van a responder los alumnos de verdad. Seis
 * personas sinteticas coherentes por construccion no son veinte personas
 * reales. Un alfa alto aca prueba que los items PUEDEN cohesionar para quien
 * responde consistente, no que alguien vaya a responder asi.
 */
import { readFileSync } from 'node:fs';
import { posicionDe, arquetipoDe, timonDe, bandaAgenciaDe, bandaDe } from '../src/lib/compas';
import type { CompasAnswers, CompasInstrument, CompasArquetipos } from '../src/types/compas';

const courseId = process.argv[2] ?? 'mgt300_2026';
const version = process.argv[3] ?? (courseId === 'mgt300_2026' ? 'v2' : 'v3');

const J = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf-8')) as T;
const instrumento = J<CompasInstrument>(`content/compas/${courseId}/instrumento_${version}.json`);
const arquetipos = J<CompasArquetipos>(`content/compas/${courseId}/arquetipos_${version}.json`);
const items = instrumento.items;

/**
 * Las respuestas se escribieron leyendo los textos, item por item, desde la
 * descripcion de cada persona. Si se edita una opcion hay que revisarlas: una
 * persona que ya no elegiria lo que dice aca es la senal de que la opcion
 * cambio de significado.
 */
const PERSONAS: Array<{ id: string; desc: string; esperado: string; answers: CompasAnswers }> = [
  // A = de acuerdo, B = ni una cosa ni la otra, C = en desacuerdo.
  // p01 p02 magnitud +, p03 p04 p05 magnitud - (clave invertida)
  // p06 p07 p08 direccion +, p09 p10 direccion - (clave invertida)
  {
    id: 'aceleracionista',
    desc: 'Cambia todo y sale bien: se reorganiza el poder, y se reparte hacia abajo.',
    esperado: 'aceleracionista',
    answers: { p01_reorganizacion: 'A', p03_trabajo: 'A', p05_un_capitulo: 'C', p07_las_de_siempre: 'C', p09_mas_ruido: 'C', p02_acceso: 'A', p04_estado_llega: 'A', p06_fiscalizar: 'A', p08_capital: 'C', p10_sin_explicar: 'C' },
  },
  {
    id: 'concentracion',
    desc: 'Cambia todo y el poder se junta en pocas manos.',
    esperado: 'concentracion',
    answers: { p01_reorganizacion: 'A', p03_trabajo: 'A', p05_un_capitulo: 'C', p07_las_de_siempre: 'C', p09_mas_ruido: 'C', p02_acceso: 'C', p04_estado_llega: 'C', p06_fiscalizar: 'C', p08_capital: 'A', p10_sin_explicar: 'A' },
  },
  {
    id: 'nada_nuevo_optimista',
    desc: 'Nada nuevo bajo el sol, y esta bien. Es la posicion que la v1 no dejaba expresar.',
    esperado: 'pragmatica',
    answers: { p01_reorganizacion: 'C', p03_trabajo: 'C', p05_un_capitulo: 'A', p07_las_de_siempre: 'A', p09_mas_ruido: 'A', p02_acceso: 'A', p04_estado_llega: 'A', p06_fiscalizar: 'A', p08_capital: 'C', p10_sin_explicar: 'C' },
  },
  {
    id: 'nada_nuevo_cinico',
    desc: 'Nada nuevo bajo el sol, y lo de siempre ya era malo.',
    esperado: 'aguafiestas',
    answers: { p01_reorganizacion: 'C', p03_trabajo: 'C', p05_un_capitulo: 'A', p07_las_de_siempre: 'A', p09_mas_ruido: 'A', p02_acceso: 'C', p04_estado_llega: 'C', p06_fiscalizar: 'C', p08_capital: 'A', p10_sin_explicar: 'A' },
  },
  {
    id: 'institucionalista',
    desc: 'Ni catastrofe ni salvacion: depende de las reglas. Contesta al medio a proposito.',
    esperado: 'institucionalista',
    answers: { p01_reorganizacion: 'B', p03_trabajo: 'B', p05_un_capitulo: 'B', p07_las_de_siempre: 'B', p09_mas_ruido: 'B', p02_acceso: 'B', p04_estado_llega: 'B', p06_fiscalizar: 'B', p08_capital: 'B', p10_sin_explicar: 'B' },
  },
  {
    id: 'aquiescente',
    desc: 'Dice que si a las diez. Con clave invertida tiene que caer cerca del origen, no en una esquina.',
    esperado: 'institucionalista',
    answers: { p01_reorganizacion: 'A', p03_trabajo: 'A', p05_un_capitulo: 'A', p07_las_de_siempre: 'A', p09_mas_ruido: 'A', p02_acceso: 'A', p04_estado_llega: 'A', p06_fiscalizar: 'A', p08_capital: 'A', p10_sin_explicar: 'A' },
  },
];

// Las personas estan escritas contra UN instrumento: sus respuestas nombran
// items por id. Contra otro instrumento no fallan ruidosamente sino que dan
// posiciones vacias, que es peor. Se detecta, se salta esa seccion y se deja
// corriendo la de cobertura, que si es independiente del contenido.
const IDS = new Set(items.map((i) => i.id));
const PERSONAS_APLICAN = PERSONAS.every((p) => Object.keys(p.answers).every((k) => IDS.has(k)));
if (!PERSONAS_APLICAN) {
  console.log(`
[!] Las personas-tipo de este script son las de mgt300_2026_compas_v2, no las de`);
  console.log(`    ${instrumento.instrumentId}. Se salta esa seccion y se corre solo la cobertura del plano.`);
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const vari = (xs: number[]) => { const m = media(xs); return media(xs.map((x) => (x - m) ** 2)); };

const ok = (b: boolean) => (b ? '  OK  ' : ' FALLA');
const rango = (xs: number[]) => Math.max(...xs) - Math.min(...xs);

if (PERSONAS_APLICAN) {
console.log(`\ncompas: ${instrumento.instrumentId}   ${items.length} items   ${PERSONAS.length} personas\n`);
console.log('persona                  magnitud  direccion  agencia  carta                banda');
console.log('-'.repeat(92));

const filas = PERSONAS.map((p) => {
  const contestadas = Object.keys(p.answers).length;
  if (contestadas !== items.length) {
    console.error(`  ! ${p.id} contesta ${contestadas} de ${items.length} items`);
  }
  const pos = posicionDe(p.answers, items)!;
  const arq = arquetipoDe(pos, timonDe(p.answers, items), arquetipos);
  const banda = bandaAgenciaDe(pos.agencia, arquetipos.bandasAgencia?.bandas);
  console.log(
    `${p.id.padEnd(24)} ${pos.magnitud.toFixed(2).padStart(7)} ${pos.direccion.toFixed(2).padStart(9)} ` +
    `${(pos.agencia ?? NaN).toFixed(2).padStart(8)}  ${(arq?.name ?? '—').padEnd(22)} ${banda?.name ?? '—'}`,
  );
  return { p, pos, arq, banda };
});

// ---- lo que el chequeo tiene que responder
console.log('\nveredicto');
console.log('-'.repeat(92));

const mags = filas.map((f) => f.pos.magnitud);
const dirs = filas.map((f) => f.pos.direccion);
const ags = filas.map((f) => f.pos.agencia).filter((a): a is number => a !== null);


console.log(`${ok(rango(dirs) >= 6)} las personas se separan en direccion: rango ${rango(dirs).toFixed(2)} (se pide >= 6)`);
console.log(`${ok(rango(mags) >= 4)} las personas se separan en magnitud:  rango ${rango(mags).toFixed(2)} (se pide >= 4)`);

const cartas = new Set(filas.map((f) => f.arq?.id));
console.log(`${ok(cartas.size >= 4)} cartas distintas: ${cartas.size} de ${PERSONAS.length} personas -> ${[...cartas].join(', ')}`);

// El tercer eje solo se chequea si el instrumento lo declara. La v2 de MGT300
// lo saco entero: con diez proposiciones y un eje por proposicion quedaba con
// dos items, que es demasiado poco para llamarlo eje.
if (instrumento.ejeAgencia) {
  const conAgencia = filas.filter((f) => f.pos.agencia !== null);
  console.log(`${ok(rango(ags) >= 8)} el eje agencia se usa entero: rango ${rango(ags).toFixed(2)} (se pide >= 8)`);
  console.log(`${ok(conAgencia.some((f) => (f.pos.agencia ?? -99) > 1.5))} el polo maquina es alcanzable`);
} else {
  console.log('  --   sin tercer eje: el instrumento no declara ejeAgencia');
}

// El aquiescente --el que dice que si a las diez proposiciones-- tiene que caer
// cerca del origen. Si cae en una esquina, la clave invertida no esta cumpliendo
// su trabajo y el instrumento esta midiendo docilidad en vez de opinion.
const aq = filas.find((f) => f.p.id === 'aquiescente');
if (aq) {
  const lejos = Math.hypot(aq.pos.magnitud, aq.pos.direccion);
  console.log(`${ok(lejos <= 2.5)} decir que si a todo no lleva a ninguna esquina: (${aq.pos.magnitud.toFixed(2)}, ${aq.pos.direccion.toFixed(2)}), a ${lejos.toFixed(2)} del origen (se pide <= 2.5)`);
}

// El del medio tambien: contestar B a las diez tiene que dar exactamente (0,0).
const med = filas.find((f) => f.p.id === 'institucionalista');
if (med) {
  const centrado = Math.abs(med.pos.magnitud) < 0.01 && Math.abs(med.pos.direccion) < 0.01;
  console.log(`${ok(centrado)} contestar el neutro en todo cae en el origen exacto: (${med.pos.magnitud.toFixed(2)}, ${med.pos.direccion.toFixed(2)})`);
}

// ---- consistencia interna sobre las personas
// ---- la carta que le toca contra la carta que la describe
//
// Esto NO evalua los items: evalua los CORTES. Los items pueden separar
// perfectamente y aun asi entregar la carta equivocada, si el limite entre
// bandas cae en el lugar equivocado. Es el mismo problema que dejo la
// aplicacion de ai_democracy_2026, donde recalibrar con terciles empiricos
// habria puesto a un pesimista dentro de La Aceleracionista.
//
// Se reporta aparte y no cuenta como falla del instrumento: mientras los
// cortes sean los provisorios de +-2.5, se espera que varias no calcen. La
// utilidad del bloque es DESPUES de la aplicacion 1, cuando haya que decidir
// los cortes definitivos: unos cortes que dejan este bloque en rojo estan
// contando una historia distinta de la que dicen las cartas.
console.log('\ncarta asignada contra carta que describe a la persona (mide los CORTES, no los items)');
console.log('-'.repeat(92));
let calzan = 0;
for (const f of filas) {
  const bien = f.arq?.id === f.p.esperado;
  if (bien) calzan += 1;
  console.log(`${bien ? '  ok  ' : '  ~~  '} ${f.p.id.padEnd(24)} esperada ${f.p.esperado.padEnd(20)} asignada ${f.arq?.id ?? '—'}`);
}
console.log(`calzan ${calzan} de ${filas.length}. Con los ejes centrados los cortes de +-2.5 caen donde corresponde;
  si al recalibrar con datos reales este numero BAJA, los cortes nuevos estan contando otra historia que las cartas.`);

console.log('\nconsistencia interna con respondentes coherentes');
console.log('-'.repeat(92));
for (const eje of ['magnitud', 'direccion'] as const) {
  const its = items.filter((it) => it.options.some((o) => o.vector[eje] !== undefined));
  const X = PERSONAS.map((p) =>
    its.map((it) => it.options.find((o) => o.id === p.answers[it.id])!.vector[eje] as number),
  );
  const K = its.length;
  const sumaVar = its.map((_, k) => vari(X.map((r) => r[k]))).reduce((a, b) => a + b, 0);
  const varTot = vari(X.map((r) => r.reduce((a, b) => a + b, 0)));
  const alpha = (K / (K - 1)) * (1 - sumaVar / varTot);
  console.log(`${ok(alpha >= 0.7)} ${eje.padEnd(10)} K=${K}  alfa = ${alpha.toFixed(2)}   (la aplicacion real del instrumento anterior dio 0.01 y 0.12)`);
}
}

// ---------------------------------------------------------------------------
// COBERTURA DEL PLANO
//
// El chequeo que faltaba y que costo una sala de prueba descubrir. Un
// instrumento puede separar a personas-tipo extremas y aun asi ser incapaz de
// mandar a nadie fuera de un cuadrante, si los vectores de las opciones no
// estan centrados. La version anterior de este instrumento tenia 6 de 45
// opciones con magnitud negativa y una correlacion magnitud-direccion de
// -0.52: 10.000 de 10.000 respuestas al azar caian abajo-derecha, y el punto
// proyectado no se movia de ahi hiciera lo que hiciera el alumno.
//
// Aca se muestrea el espacio de respuestas de verdad --secuencias completas,
// al azar-- y se exige que ocupen las cuatro esquinas del plano y la mayoria
// de las nueve celdas. Si no las ocupan, el problema esta en las opciones o en
// la regla de agregacion, no en el curso.
console.log('\ncobertura del plano: 200.000 secuencias de respuesta al azar');
console.log('-'.repeat(92));

const RONDAS = 200_000;
const cuadrantes: Record<string, number> = { 'izq-arriba': 0, 'der-arriba': 0, 'izq-abajo': 0, 'der-abajo': 0 };
const celdas: Record<string, number> = {};
const ejemplo: Record<string, CompasAnswers> = {};
let semilla = 20260818;
const rnd = () => {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return semilla / 0x7fffffff;
};

for (let k = 0; k < RONDAS; k++) {
  const answers: CompasAnswers = {};
  for (const it of items) answers[it.id] = it.options[Math.floor(rnd() * it.options.length)].id;
  const pos = posicionDe(answers, items);
  if (!pos) continue;
  const q = (pos.magnitud >= 0 ? 'der' : 'izq') + '-' + (pos.direccion >= 0 ? 'arriba' : 'abajo');
  cuadrantes[q] += 1;
  const arq = arquetipoDe(pos, timonDe(answers, items), arquetipos);
  const celda = `${bandaDe(pos.magnitud, arquetipos.cortes.magnitud)}/${bandaDe(pos.direccion, arquetipos.cortes.direccion)}`;
  celdas[celda] = (celdas[celda] ?? 0) + 1;
  if (!ejemplo[celda]) ejemplo[celda] = { ...answers, __arq: arq?.id ?? 'null' } as CompasAnswers;
}

const pct = (n: number) => ((100 * n) / RONDAS).toFixed(1).padStart(5) + '%';
console.log('cuadrantes:');
for (const [q, n] of Object.entries(cuadrantes)) {
  console.log(`  ${ok(n > 0)} ${q.padEnd(12)} ${pct(n)}  ${String(n).padStart(7)}`);
}

const BANDAS3 = ['bajo', 'medio', 'alto'];
console.log('\nlas nueve celdas de la grilla (magnitud / direccion):');
let celdasVivas = 0;
for (const bm of BANDAS3) {
  const fila = BANDAS3.map((bd) => {
    const n = celdas[`${bm}/${bd}`] ?? 0;
    if (n > 0) celdasVivas += 1;
    return `${bd.padEnd(5)} ${n > 0 ? pct(n) : '  ----'}`;
  });
  console.log(`  magnitud ${bm.padEnd(6)} | ${fila.join(' | ')}`);
}

console.log('\nuna secuencia de ejemplo por celda alcanzada:');
for (const bm of BANDAS3) {
  for (const bd of BANDAS3) {
    const e = ejemplo[`${bm}/${bd}`];
    if (!e) continue;
    const letras = items.map((it) => (e as Record<string, string>)[it.id]).join("");
    console.log(`  ${bm.padEnd(5)}/${bd.padEnd(5)} -> ${letras}  (${(e as Record<string, string>).__arq})`);
  }
}

const cuadrantesVivos = Object.values(cuadrantes).filter((n) => n > 0).length;
console.log('\nveredicto de cobertura');
console.log('-'.repeat(92));
console.log(`${ok(cuadrantesVivos === 4)} los cuatro cuadrantes son alcanzables: ${cuadrantesVivos} de 4`);
console.log(`${ok(celdasVivas >= 6)} celdas de la grilla alcanzables: ${celdasVivas} de 9 (se piden >= 6)`);
const menor = Math.min(...Object.values(cuadrantes));
console.log(`${ok(menor / RONDAS >= 0.02)} el cuadrante mas raro se lleva ${pct(menor)} (se pide >= 2.0%, para que no sea una rareza aritmetica)`);

const falla = cuadrantesVivos < 4 || celdasVivas < 6 || menor / RONDAS < 0.02;

console.log('\nRecordatorio: esto mide si los items PUEDEN cohesionar y si el plano PUEDE ocuparse,');
console.log('no como va a responder el curso. El unico chequeo que dice eso es aplicarlo.\n');

if (falla) {
  console.error('COBERTURA INSUFICIENTE: hay que cambiar las opciones o la regla de agregacion.\n');
  process.exit(1);
}
