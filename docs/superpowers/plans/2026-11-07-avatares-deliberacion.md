# Avatares, deliberación simulada y puentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sala en ml2-master-game donde los alumnos llenan una planilla y votan propuestas; Naim genera un avatar por alumno con LLMs, MiroFish simula la deliberación de esos mismos alumnos, y el proyector muestra mayoría contra puente en un mapa común de personas y propuestas.

**Architecture:** Un contrato de datos único (`Matriz`: personas × propuestas, con huecos) que escriben la app (humanos), una Function (avatares) y un puente con MiroFish (avatares solos y en red); una librería de analítica pura en TypeScript lo lee y alimenta la pantalla de la sala. MiroFish corre en WSL como línea nueva `ayd14`, sin tocar el motor.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind (frontend), Firebase Firestore + Cloud Functions v1 (`us-central1`), Vitest, `@firebase/rules-unit-testing`; MiroFish (Python 3, OASIS, Gemini `gemini-2.5-flash-lite` por el proxy, Zep), pytest.

**Spec:** `docs/superpowers/specs/2026-11-07-avatares-deliberacion-design.md` (léelo antes de empezar).

## Global Constraints

- No puntúa, no rankea, no entra en la nota (regla 1 del compás, `CLAUDE.md`).
- Nada proyectado lleva nombres. Planillas y votos humanos: los lee solo el anfitrión.
- Al LLM y a MiroFish va solo el texto seudonimizado de la planilla: sin nombre, uid, correo ni ciudad; edad en tramos.
- Las respuestas de los alumnos a las propuestas **nunca** entran en la persona ni en la semilla.
- Escala de voto: Likert 1–5; «aprueba» = 4 o 5. MiroFish: A → 5, B → 1, C/D → 3.
- Community Notes: valores `(v−1)/4`, λ_intercepto = 0,15, λ_factor = 0,03, factor de 1 dimensión.
- Claves de API solo vía Functions desplegadas; nunca en scripts locales, logs ni archivos.
- Node solo existe en WSL: todo `npm`/`npx` corre con `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-master-game && ..."`. Vite necesita Node 20.19.5 de nvm (`source ~/.nvm/nvm.sh && nvm use 20.19.5`).
- Trabajar en la rama `feat/avatares-s14` (worktree); `main` tiene cambios ajenos sin commitear de la clase 05 que no se tocan.
- Push a `main` (despliega GitHub Pages), despliegue de reglas y de Functions: **solo con el OK explícito de Naim**, cada vez.
- MiroFish: respetar `mirofish/CLAUDE.md` entero (memoria, 127.0.0.1, `scripts/start.sh`, `memwatch`, `scripts/stop.sh` al final, modelo fijado, nada de personas a Zep).
- Textos de la interfaz en español, tono del resto de la app. Sin texto de consentimiento (lo dice Naim oralmente).

## Review Focus

1. **Un alumno recarga el teléfono a mitad de la planilla o la envía dos veces** → no se duplica ni se pierde: escrituras idempotentes por uid (Task 7, prueba de `guardarPlanilla` dos veces).
2. **Alumnos que llenaron la planilla y no la encuesta, o al revés** → las correlaciones solo usan pares completos y la sala muestra cuántos quedaron fuera (Task 3, prueba de `correlacionPorPropuesta` con refs sin pareja).
3. **El LLM devuelve un valor fuera de rango, un string `"4"`, un id que no existe o le falta un id** → se normaliza lo normalizable, lo demás queda como hueco, un reintento, y la persona se marca con sus faltantes; nunca tumba la corrida (Task 9, pruebas de `normalizarVotos`).
4. **Muy pocos humanos (N < 6) o todos votan igual** → PCA con varianza cero y k-means con menos puntos distintos que k no revientan: devuelven un resultado degenerado marcado `degenerado: true` y la sala lo dice (Task 4, pruebas con N=3 y con votos idénticos).
5. **Correr `votarComoAvatares` o la importación de MiroFish dos veces** → los mismos ids de persona se sobrescriben; no aparecen avatares duplicados (Task 9 y Task 14, ids deterministas probados).

---

## Mapa de archivos

**ml2-master-game**

| Archivo | Responsabilidad |
|---|---|
| `src/lib/avatares/contrato.ts` | Tipos del contrato, `refDe`, ids de persona, `validarMatriz` |
| `src/lib/avatares/planilla.ts` | `planillaComoTexto`: la planilla seudonimizada como texto (fuente única para LLM y MiroFish) |
| `content/avatares/ai_democracy_2026/instrumento_vina_v1.json` | Relleno: 12 ítems de Viña + planilla de Viña |
| `src/lib/avatares/instrumentos.ts` | Registro estático de instrumentos |
| `src/lib/avatares/analitica/basico.ts` | `aprobacion`, `correlacionPorPropuesta`, `dispersion` |
| `src/lib/avatares/analitica/mapa.ts` | `mapaPCA`, `grupos` (k-means + silueta) |
| `src/lib/avatares/analitica/puentes.ts` | `puentePolis`, `factorizacionCN`, `rankings`, `inundar` |
| `src/lib/avatares/azar.ts` | PRNG con semilla (`mulberry32`) |
| `src/lib/avatares/sinteticos.ts` + `content/avatares/fixtures/panel_estudiantes_v1.json` | Datos sintéticos |
| `src/lib/avatares/sala.ts` | Firestore: crear sala, inscribirse, guardar planilla/votos, fases, `aMatriz` |
| `src/hooks/useAvataresRun.ts` | Suscripción a la sala |
| `src/pages/avatares/{CrearAvatares,AvataresJugar,AvataresSala,AvataresPreview}.tsx` | Pantallas |
| `src/components/avatares/{MapaComun,TablaPuente,BarrasCorrelacion}.tsx` | Gráficos SVG |
| `functions/src/lib/avatares.ts` | Prompt, `normalizarVotos`, ids (puro, testeado) |
| `functions/src/index.ts` | Callable `votarComoAvatares` |
| `firestore.rules`, `scripts/test-avatares-rules.mjs`, `package.json` | Reglas y sus pruebas |
| `src/lib/avatares/mirofishPuente.ts` | `panelDesdePlanillas`, `itemsDesdeInstrumento`, `validarResultadosMirofish` (puro) |
| `scripts/avatares-mirofish-export.ts`, `scripts/avatares-mirofish-import.ts` | Firestore ↔ archivos de MiroFish |

**mirofish**

| Archivo | Responsabilidad |
|---|---|
| `projects/ayd14/__init__.py`, `config.py`, `panel_spec.py` | Línea `ayd14`; spec del panel leído del JSON exportado |
| `ayd14/__init__.py`, `ayd14/paths.py` | Rutas y la aprobación registrada |
| `ayd14/semilla.py` | Pack con forma de pack desde el instrumento + extra editorial |
| `ayd14/mirofish.py` | `prepare`, `simulate` (línea base en paralelo), `freeze`, `resultados` |
| `scripts/run_ayd14.sh` | Envoltorio con memoria, proxy y `stop.sh` |
| `tests/test_ayd14.py` | pytest de lo puro |

Grupos independientes después de la Task 1: **{3, 4, 5, 6}**, **{7, 8, 9, 10, 11}**, **{12, 13, 14}**.

---

### Task 0: Rama de trabajo

**Files:** ninguno.

- [ ] **Step 1: Crear el worktree desde `main` sin arrastrar los cambios de la clase 05**

```bash
cd /c/Users/naim.bro.k/claude_projects/games/ml2-master-game
git worktree add ../ml2-avatares -b feat/avatares-s14 main
```

- [ ] **Step 2: Instalar dependencias en el worktree (WSL)**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && source ~/.nvm/nvm.sh && nvm use 20.19.5 && npm ci && (cd functions && npm ci)"
```

Expected: termina sin errores. Desde aquí, todas las rutas de ml2 son relativas a `ml2-avatares/`.

- [ ] **Step 3: Copiar el spec y este plan al worktree y commitear**

```bash
cd /c/Users/naim.bro.k/claude_projects/games/ml2-avatares
cp ../ml2-master-game/docs/superpowers/specs/2026-11-07-avatares-deliberacion-design.md docs/superpowers/specs/
mkdir -p docs/superpowers/plans && cp ../ml2-master-game/docs/superpowers/plans/2026-11-07-avatares-deliberacion.md docs/superpowers/plans/
git add docs/superpowers && git commit -m "docs(avatares): spec y plan de la actividad de la Semana 14

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Contrato de datos (M0)

**Files:**
- Create: `src/lib/avatares/contrato.ts`
- Test: `src/lib/avatares/contrato.test.ts`

**Interfaces:**
- Produces:
  - `type Fuente = 'humano' | 'avatar' | 'avatar_red' | 'bot'`, `type Via = 'app' | 'mirofish' | 'simulado'`
  - `interface CampoPlanilla { id: string; etiqueta: string; tipo: 'texto' | 'opcion' | 'escala'; opciones?: string[]; sensible?: boolean; ayuda?: string }`
  - `interface Propuesta { id: string; texto: string; origen: 'instrumento' | 'alumno' | 'llm'; autorRef?: string; tema?: string; polo?: string }`
  - `interface Instrumento { id: string; version: number; titulo: string; escala: { min: 1; max: 5; aprueba: 4; etiquetas: string[] }; planilla: CampoPlanilla[]; propuestas: Propuesta[] }`
  - `interface Persona { id: string; ref: string; fuente: Fuente; via: Via; modelo?: string; replica?: number; condicion?: string }`
  - `interface Voto { persona: string; propuesta: string; valor: number }`
  - `interface Matriz { instrumento: Instrumento; personas: Persona[]; votos: Voto[] }`
  - `refDe(uid: string, code: string): string` → `'r' + 12 hex`, determinista
  - `idHumano(ref)`, `idAvatar(modelo, ref)`, `idMirofishBase(ref)`, `idMirofishRed(replica, ref)`, `idBot(i, ref)`: `string`
  - `aprueba(valor: number): boolean`
  - `validarMatriz(m: Matriz): string[]` (lista de errores; vacía = válida)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/avatares/contrato.test.ts
import { describe, expect, it } from 'vitest';
import {
  aprueba, idAvatar, idBot, idHumano, idMirofishBase, idMirofishRed, refDe, validarMatriz,
  type Instrumento, type Matriz,
} from './contrato';

const inst: Instrumento = {
  id: 't', version: 1, titulo: 'T',
  escala: { min: 1, max: 5, aprueba: 4, etiquetas: ['1', '2', '3', '4', '5'] },
  planilla: [],
  propuestas: [
    { id: 'p1', texto: 'Uno', origen: 'instrumento' },
    { id: 'p2', texto: 'Dos', origen: 'instrumento' },
  ],
};

describe('refDe', () => {
  it('es determinista, opaco y depende de la sala', () => {
    const a = refDe('uid-ana', 'ABC123');
    expect(a).toBe(refDe('uid-ana', 'ABC123'));
    expect(a).toMatch(/^r[0-9a-f]{12}$/);
    expect(a).not.toContain('ana');
    expect(refDe('uid-ana', 'XYZ999')).not.toBe(a);
    expect(refDe('uid-beto', 'ABC123')).not.toBe(a);
  });
});

describe('ids de persona', () => {
  it('son deterministas y sin barras', () => {
    expect(idHumano('r1')).toBe('h_r1');
    expect(idAvatar('gemini-2.5-pro', 'r1')).toBe('a_gemini-2.5-pro_r1');
    expect(idAvatar('org/model', 'r1')).toBe('a_org-model_r1');
    expect(idMirofishBase('r1')).toBe('mb_r1');
    expect(idMirofishRed(2, 'r1')).toBe('mr2_r1');
    expect(idBot(3, 'r1')).toBe('bot3_r1');
  });
});

describe('aprueba', () => {
  it('4 y 5 aprueban; 3 no', () => {
    expect([1, 2, 3, 4, 5].map(aprueba)).toEqual([false, false, false, true, true]);
  });
});

describe('validarMatriz', () => {
  const base: Matriz = {
    instrumento: inst,
    personas: [{ id: 'h_r1', ref: 'r1', fuente: 'humano', via: 'app' }],
    votos: [{ persona: 'h_r1', propuesta: 'p1', valor: 4 }],
  };
  it('acepta una matriz con huecos', () => {
    expect(validarMatriz(base)).toEqual([]);
  });
  it('rechaza valores fuera de escala, no enteros, personas y propuestas inexistentes, duplicados', () => {
    const m: Matriz = {
      ...base,
      personas: [...base.personas, { id: 'h_r1', ref: 'r1', fuente: 'humano', via: 'app' }],
      votos: [
        { persona: 'h_r1', propuesta: 'p1', valor: 6 },
        { persona: 'h_r1', propuesta: 'p2', valor: 2.5 },
        { persona: 'x', propuesta: 'p1', valor: 3 },
        { persona: 'h_r1', propuesta: 'p9', valor: 3 },
      ],
    };
    const errs = validarMatriz(m);
    expect(errs.some((e) => e.includes('persona duplicada'))).toBe(true);
    expect(errs.some((e) => e.includes('fuera de escala'))).toBe(true);
    expect(errs.some((e) => e.includes('no entero'))).toBe(true);
    expect(errs.some((e) => e.includes('persona inexistente'))).toBe(true);
    expect(errs.some((e) => e.includes('propuesta inexistente'))).toBe(true);
  });
  it('rechaza dos votos de la misma persona a la misma propuesta', () => {
    const m: Matriz = { ...base, votos: [...base.votos, { persona: 'h_r1', propuesta: 'p1', valor: 2 }] };
    expect(validarMatriz(m).some((e) => e.includes('voto repetido'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/contrato.test.ts"`
Expected: FAIL, `Cannot find module './contrato'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/avatares/contrato.ts
// El contrato que comparten la app, la Function de avatares, el puente con
// MiroFish y la analitica. Spec 2026-11-07, seccion M0. Una matriz larga con
// huecos: cada persona (humano, avatar, avatar en red, bot) vota un subconjunto
// de propuestas en Likert 1-5.

export type Fuente = 'humano' | 'avatar' | 'avatar_red' | 'bot';
export type Via = 'app' | 'mirofish' | 'simulado';

export interface CampoPlanilla {
  id: string;
  etiqueta: string;
  tipo: 'texto' | 'opcion' | 'escala';
  opciones?: string[];
  /** No sale nunca hacia un LLM ni hacia MiroFish (p. ej. la ciudad). */
  sensible?: boolean;
  ayuda?: string;
}

export interface Propuesta {
  id: string;
  texto: string;
  origen: 'instrumento' | 'alumno' | 'llm';
  autorRef?: string;
  tema?: string;
  /** La posicion contraria con nombre. MiroFish la necesita (no acepta acuerdo/desacuerdo). */
  polo?: string;
}

export interface Instrumento {
  id: string;
  version: number;
  titulo: string;
  escala: { min: 1; max: 5; aprueba: 4; etiquetas: string[] };
  planilla: CampoPlanilla[];
  propuestas: Propuesta[];
}

export interface Persona {
  id: string;
  /** Seudonimo del humano al que corresponde. Une al humano con todos sus avatares. */
  ref: string;
  fuente: Fuente;
  via: Via;
  modelo?: string;
  replica?: number;
  condicion?: string;
}

export interface Voto {
  persona: string;
  propuesta: string;
  valor: number;
}

export interface Matriz {
  instrumento: Instrumento;
  personas: Persona[];
  votos: Voto[];
}

/** FNV-1a de 32 bits. No es criptografico: basta para un seudonimo de curso. */
function fnv1a(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function refDe(uid: string, code: string): string {
  const s = `${code}:${uid}`;
  const a = fnv1a(s, 0x811c9dc5).toString(16).padStart(8, '0');
  const b = fnv1a(s, 0x9e3779b9).toString(16).padStart(8, '0');
  return `r${(a + b).slice(0, 12)}`;
}

const limpio = (s: string) => s.replace(/[/\s]+/g, '-');

export const idHumano = (ref: string) => `h_${ref}`;
export const idAvatar = (modelo: string, ref: string) => `a_${limpio(modelo)}_${ref}`;
export const idMirofishBase = (ref: string) => `mb_${ref}`;
export const idMirofishRed = (replica: number, ref: string) => `mr${replica}_${ref}`;
export const idBot = (i: number, ref: string) => `bot${i}_${ref}`;

export const aprueba = (valor: number) => valor >= 4;

export function validarMatriz(m: Matriz): string[] {
  const errs: string[] = [];
  const personas = new Set<string>();
  for (const p of m.personas) {
    if (personas.has(p.id)) errs.push(`persona duplicada: ${p.id}`);
    personas.add(p.id);
  }
  const propuestas = new Set(m.instrumento.propuestas.map((p) => p.id));
  const vistos = new Set<string>();
  for (const v of m.votos) {
    if (!personas.has(v.persona)) errs.push(`persona inexistente: ${v.persona}`);
    if (!propuestas.has(v.propuesta)) errs.push(`propuesta inexistente: ${v.propuesta}`);
    if (!Number.isInteger(v.valor)) errs.push(`valor no entero: ${v.persona}/${v.propuesta}=${v.valor}`);
    else if (v.valor < m.instrumento.escala.min || v.valor > m.instrumento.escala.max)
      errs.push(`valor fuera de escala: ${v.persona}/${v.propuesta}=${v.valor}`);
    const k = `${v.persona}|${v.propuesta}`;
    if (vistos.has(k)) errs.push(`voto repetido: ${k}`);
    vistos.add(k);
  }
  return errs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same command as Step 2. Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatares/contrato.ts src/lib/avatares/contrato.test.ts
git commit -m "feat(avatares): contrato de datos de la actividad de la Semana 14

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Instrumento de relleno y texto seudonimizado de la planilla

**Files:**
- Create: `content/avatares/ai_democracy_2026/instrumento_vina_v1.json`
- Create: `src/lib/avatares/instrumentos.ts`
- Create: `src/lib/avatares/planilla.ts`
- Test: `src/lib/avatares/instrumentos.test.ts`, `src/lib/avatares/planilla.test.ts`

**Interfaces:**
- Consumes: `Instrumento`, `CampoPlanilla`, `validarMatriz` (Task 1)
- Produces:
  - `INSTRUMENTOS: Record<string, { instrumentoId: string; nombre: string; courseId: string; instrumento: Instrumento }>`
  - `instrumentoDe(id: string): Instrumento | null`
  - `type Planilla = Record<string, string>` (id de campo → respuesta)
  - `tramoEdad(edad: string): string` (`'18-20' | '21-25' | '26-30' | '31+' | 'no informa'`)
  - `planillaComoTexto(inst: Instrumento, p: Planilla): string` — sin campos `sensible`, edad en tramo

- [ ] **Step 1: Escribir el instrumento.** Textos de los ítems tomados del formulario de Viña (verificados el 7-nov). Los `polo` son un borrador para que Naim corrija (decisión E7).

```json
{
  "id": "ayd14_vina_v1",
  "version": 1,
  "titulo": "Avatares · Semana 14 (ítems de Viña)",
  "escala": { "min": 1, "max": 5, "aprueba": 4,
    "etiquetas": ["Totalmente en desacuerdo", "En desacuerdo", "Ni de acuerdo ni en desacuerdo", "De acuerdo", "Totalmente de acuerdo"] },
  "planilla": [
    { "id": "edad", "etiqueta": "Edad", "tipo": "texto" },
    { "id": "genero", "etiqueta": "Género (opcional)", "tipo": "texto" },
    { "id": "pais_ciudad", "etiqueta": "País / ciudad", "tipo": "texto", "sensible": true },
    { "id": "nivel_educativo", "etiqueta": "Nivel educativo", "tipo": "texto" },
    { "id": "ocupacion", "etiqueta": "Ocupación actual", "tipo": "texto" },
    { "id": "economia", "etiqueta": "En economía me considero", "tipo": "texto", "ayuda": "ej. izquierda redistributiva, centro socialdemócrata, derecha liberal de mercado" },
    { "id": "rol_estado", "etiqueta": "El rol del Estado en la economía debería ser", "tipo": "opcion", "opciones": ["mínimo", "equilibrado", "fuerte intervención"] },
    { "id": "social", "etiqueta": "En temas sociales me considero", "tipo": "texto", "ayuda": "ej. progresista, conservador, libertario" },
    { "id": "derechos_civiles", "etiqueta": "Respecto a derechos civiles (matrimonio igualitario, aborto, etc.)", "tipo": "opcion", "opciones": ["a favor", "en contra", "con matices"] },
    { "id": "ambiental", "etiqueta": "En temas ambientales me considero", "tipo": "opcion", "opciones": ["crecimiento económico primero", "balance", "prioridad al medio ambiente"] },
    { "id": "cambio_climatico", "etiqueta": "Respecto al cambio climático", "tipo": "opcion", "opciones": ["no es prioridad", "es un tema importante", "es una emergencia global"] },
    { "id": "prioridad_1", "etiqueta": "Prioridad política 1", "tipo": "texto" },
    { "id": "prioridad_2", "etiqueta": "Prioridad política 2", "tipo": "texto" },
    { "id": "prioridad_3", "etiqueta": "Prioridad política 3", "tipo": "texto" },
    { "id": "conf_congreso", "etiqueta": "Confianza en el congreso (1 a 5)", "tipo": "escala" },
    { "id": "conf_gobierno", "etiqueta": "Confianza en el gobierno (1 a 5)", "tipo": "escala" },
    { "id": "conf_partidos", "etiqueta": "Confianza en los partidos (1 a 5)", "tipo": "escala" },
    { "id": "conf_justicia", "etiqueta": "Confianza en la justicia (1 a 5)", "tipo": "escala" },
    { "id": "conf_ciencia", "etiqueta": "Confianza en la ciencia y la tecnología (1 a 5)", "tipo": "escala" }
  ],
  "propuestas": [
    { "id": "salario_minimo", "origen": "instrumento", "tema": "Salario mínimo", "texto": "El salario mínimo debería aumentar significativamente aunque eso pueda afectar a las empresas.", "polo": "El salario mínimo debería subir solo al ritmo que las empresas puedan pagar sin despedir." },
    { "id": "estado_servicios", "origen": "instrumento", "tema": "Rol del Estado", "texto": "El Estado debe tener un rol central en proveer servicios básicos como salud y educación.", "polo": "Salud y educación funcionan mejor con proveedores privados que compiten y el Estado solo subsidia a quien lo necesita." },
    { "id": "impuestos_ricos", "origen": "instrumento", "tema": "Impuestos", "texto": "Los impuestos a los más ricos deberían subir para financiar programas sociales.", "polo": "Subir impuestos a los más ricos espanta la inversión; los programas sociales deben financiarse con crecimiento." },
    { "id": "matrimonio_igualitario", "origen": "instrumento", "tema": "Matrimonio igualitario", "texto": "El matrimonio igualitario debe estar garantizado en la Constitución.", "polo": "El matrimonio igualitario debe quedar en la ley, que se puede cambiar, no en la Constitución." },
    { "id": "aborto", "origen": "instrumento", "tema": "Aborto", "texto": "El aborto debería ser legal en todas las circunstancias.", "polo": "El aborto debería ser legal solo en causales acotadas." },
    { "id": "migracion", "origen": "instrumento", "tema": "Migración", "texto": "La migración debe ser facilitada y apoyada por el Estado.", "polo": "El Estado debe restringir y controlar más estrictamente la migración." },
    { "id": "cambio_climatico", "origen": "instrumento", "tema": "Cambio climático", "texto": "El Estado debería priorizar la lucha contra el cambio climático aunque afecte el crecimiento económico.", "polo": "El crecimiento económico debe ir primero; la acción climática no puede frenarlo." },
    { "id": "areas_protegidas", "origen": "instrumento", "tema": "Recursos naturales", "texto": "Se debería prohibir la explotación de recursos naturales en áreas protegidas.", "polo": "En áreas protegidas debería permitirse explotar recursos con evaluación ambiental estricta." },
    { "id": "regular_ia", "origen": "instrumento", "tema": "Regulación de la IA", "texto": "La inteligencia artificial debería regularse estrictamente para evitar sesgos y manipulación política.", "polo": "Regular estrictamente la IA frena la innovación; bastan reglas mínimas y autorregulación." },
    { "id": "representantes_humanos", "origen": "instrumento", "tema": "Representación", "texto": "La democracia funciona mejor con representantes electos humanos que con avatares digitales.", "polo": "Un avatar digital entrenado con mis preferencias me representaría mejor que un representante electo." },
    { "id": "referendos", "origen": "instrumento", "tema": "Democracia directa", "texto": "Se deberían hacer más referendos para decidir directamente sobre leyes importantes.", "polo": "Las leyes importantes deben decidirlas representantes que deliberan, no referendos." },
    { "id": "ciencia_democracia", "origen": "instrumento", "tema": "Ciencia y democracia", "texto": "Confío en que la ciencia y la tecnología pueden mejorar la calidad de la democracia.", "polo": "La ciencia y la tecnología tienden a concentrar poder y no mejoran la democracia por sí solas." }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/avatares/instrumentos.test.ts
import { describe, expect, it } from 'vitest';
import { INSTRUMENTOS, instrumentoDe } from './instrumentos';

describe('INSTRUMENTOS', () => {
  it('cada instrumento tiene ids unicos, 5 etiquetas y polo en toda propuesta', () => {
    for (const { instrumento } of Object.values(INSTRUMENTOS)) {
      const ids = instrumento.propuestas.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      const campos = instrumento.planilla.map((c) => c.id);
      expect(new Set(campos).size).toBe(campos.length);
      expect(instrumento.escala.etiquetas).toHaveLength(5);
      for (const p of instrumento.propuestas) {
        expect(p.texto.trim()).not.toBe('');
        expect(p.polo?.trim()).toBeTruthy();
        expect(p.polo).not.toBe(p.texto);
      }
    }
  });
  it('el de Viña tiene 12 propuestas y la ciudad marcada como sensible', () => {
    const i = instrumentoDe('ayd14_vina_v1')!;
    expect(i.propuestas).toHaveLength(12);
    expect(i.planilla.find((c) => c.id === 'pais_ciudad')?.sensible).toBe(true);
  });
  it('devuelve null para un id desconocido', () => {
    expect(instrumentoDe('nope')).toBeNull();
  });
});
```

```ts
// src/lib/avatares/planilla.test.ts
import { describe, expect, it } from 'vitest';
import { instrumentoDe } from './instrumentos';
import { planillaComoTexto, tramoEdad } from './planilla';

const inst = instrumentoDe('ayd14_vina_v1')!;

describe('tramoEdad', () => {
  it('agrupa en tramos y tolera texto', () => {
    expect(tramoEdad('19')).toBe('18-20');
    expect(tramoEdad('22 años')).toBe('21-25');
    expect(tramoEdad('29')).toBe('26-30');
    expect(tramoEdad('45')).toBe('31+');
    expect(tramoEdad('')).toBe('no informa');
    expect(tramoEdad('veinte')).toBe('no informa');
  });
});

describe('planillaComoTexto', () => {
  const p = { edad: '22', pais_ciudad: 'Chile, Viña del Mar', economia: 'centro socialdemócrata',
    rol_estado: 'equilibrado', prioridad_1: 'educación', conf_congreso: '2' };
  const t = planillaComoTexto(inst, p);
  it('no incluye campos sensibles ni la edad exacta', () => {
    expect(t).not.toContain('Viña');
    expect(t).not.toContain('22');
    expect(t).toContain('21-25');
  });
  it('incluye las respuestas con su etiqueta y omite los campos vacios', () => {
    expect(t).toContain('En economía me considero: centro socialdemócrata');
    expect(t).toContain('Prioridad política 1: educación');
    expect(t).not.toContain('Género');
  });
  it('es determinista', () => {
    expect(planillaComoTexto(inst, p)).toBe(t);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/instrumentos.test.ts src/lib/avatares/planilla.test.ts"`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/avatares/instrumentos.ts
// Registro estatico, como compasContent.ts: imports a mano, que `npm run build`
// atrapa si una ruta se pudre. No vive en courses.ts por la misma razon que el
// compas: no es una sesion y no se puntua.
import vina from '../../../content/avatares/ai_democracy_2026/instrumento_vina_v1.json';
import type { Instrumento } from './contrato';

export interface InstrumentoPack {
  instrumentoId: string;
  nombre: string;
  courseId: string;
  instrumento: Instrumento;
}

export const INSTRUMENTOS: Record<string, InstrumentoPack> = {
  ayd14_vina_v1: {
    instrumentoId: 'ayd14_vina_v1',
    nombre: 'AyD · Semana 14 · avatares (ítems de Viña)',
    courseId: 'ai_democracy_2026',
    instrumento: vina as Instrumento,
  },
};

export function instrumentoDe(id: string): Instrumento | null {
  return INSTRUMENTOS[id]?.instrumento ?? null;
}
```

```ts
// src/lib/avatares/planilla.ts
// Fuente UNICA del texto que sale hacia un LLM (Function de avatares) y hacia
// MiroFish (persona). Sin campos sensibles y con la edad en tramos.
import type { Instrumento } from './contrato';

export type Planilla = Record<string, string>;

export function tramoEdad(edad: string): string {
  const m = /\d+/.exec(edad ?? '');
  if (!m) return 'no informa';
  const n = Number(m[0]);
  if (n <= 20) return '18-20';
  if (n <= 25) return '21-25';
  if (n <= 30) return '26-30';
  return '31+';
}

export function planillaComoTexto(inst: Instrumento, p: Planilla): string {
  const lineas: string[] = [];
  for (const c of inst.planilla) {
    if (c.sensible) continue;
    const v = (p[c.id] ?? '').trim();
    if (!v) continue;
    if (c.id === 'edad') lineas.push(`Edad (tramo): ${tramoEdad(v)}`);
    else lineas.push(`${c.etiqueta}: ${v}`);
  }
  return lineas.join('\n');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: same as Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add content/avatares src/lib/avatares/instrumentos.ts src/lib/avatares/planilla.ts src/lib/avatares/*.test.ts
git commit -m "feat(avatares): instrumento de Viña y planilla seudonimizada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Analítica básica (M3a)

**Files:**
- Create: `src/lib/avatares/analitica/basico.ts`
- Test: `src/lib/avatares/analitica/basico.test.ts`

**Interfaces:**
- Consumes: `Matriz`, `Fuente`, `aprueba` (Task 1)
- Produces:
  - `type FiltroPersona = (p: Persona) => boolean`; `porFuente(f: Fuente, extra?: Partial<Persona>): FiltroPersona`
  - `valoresPorPropuesta(m: Matriz, filtro: FiltroPersona): Map<string, Map<string, number>>` (propuesta → ref → valor)
  - `aprobacion(m, filtro): Record<string, { aprueban: number; n: number; tasa: number }>`
  - `correlacionPorPropuesta(m, filtroA, filtroB): { porPropuesta: Record<string, { r: number | null; n: number }>; promedio: number | null; refsSinPareja: number }`
  - `dispersion(m, filtro): Record<string, number>` (varianza poblacional por propuesta; NaN si n = 0)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/avatares/analitica/basico.test.ts
import { describe, expect, it } from 'vitest';
import type { Instrumento, Matriz, Persona, Voto } from '../contrato';
import { aprobacion, correlacionPorPropuesta, dispersion, porFuente } from './basico';

const inst: Instrumento = {
  id: 't', version: 1, titulo: 't',
  escala: { min: 1, max: 5, aprueba: 4, etiquetas: ['1', '2', '3', '4', '5'] },
  planilla: [], propuestas: [{ id: 'p1', texto: 'a', origen: 'instrumento' }, { id: 'p2', texto: 'b', origen: 'instrumento' }],
};

function matriz(h: Record<string, [number, number]>, a: Record<string, [number, number]>): Matriz {
  const personas: Persona[] = [];
  const votos: Voto[] = [];
  for (const [ref, [v1, v2]] of Object.entries(h)) {
    personas.push({ id: `h_${ref}`, ref, fuente: 'humano', via: 'app' });
    votos.push({ persona: `h_${ref}`, propuesta: 'p1', valor: v1 }, { persona: `h_${ref}`, propuesta: 'p2', valor: v2 });
  }
  for (const [ref, [v1, v2]] of Object.entries(a)) {
    personas.push({ id: `a_m_${ref}`, ref, fuente: 'avatar', via: 'app', modelo: 'm' });
    votos.push({ persona: `a_m_${ref}`, propuesta: 'p1', valor: v1 }, { persona: `a_m_${ref}`, propuesta: 'p2', valor: v2 });
  }
  return { instrumento: inst, personas, votos };
}

describe('aprobacion', () => {
  it('cuenta 4 y 5 como aprobacion, por fuente', () => {
    const m = matriz({ r1: [5, 1], r2: [4, 2], r3: [3, 5] }, { r1: [5, 5] });
    const h = aprobacion(m, porFuente('humano'));
    expect(h.p1).toEqual({ aprueban: 2, n: 3, tasa: 2 / 3 });
    expect(h.p2.tasa).toBeCloseTo(1 / 3);
    expect(aprobacion(m, porFuente('avatar')).p2.tasa).toBe(1);
  });
  it('una propuesta sin votos tiene n=0 y tasa NaN', () => {
    const m = matriz({}, {});
    expect(aprobacion(m, porFuente('humano')).p1.n).toBe(0);
    expect(Number.isNaN(aprobacion(m, porFuente('humano')).p1.tasa)).toBe(true);
  });
});

describe('correlacionPorPropuesta', () => {
  it('empareja por ref y cuenta los que quedan sin pareja', () => {
    const m = matriz(
      { r1: [1, 5], r2: [3, 3], r3: [5, 1], solo_h: [2, 2] },
      { r1: [1, 4], r2: [3, 3], r3: [5, 2], solo_a: [4, 4] },
    );
    const c = correlacionPorPropuesta(m, porFuente('humano'), porFuente('avatar'));
    expect(c.porPropuesta.p1.n).toBe(3);
    expect(c.porPropuesta.p1.r).toBeCloseTo(1);
    expect(c.porPropuesta.p2.r).toBeCloseTo(1);
    expect(c.refsSinPareja).toBe(2);
    expect(c.promedio).toBeCloseTo(1);
  });
  it('r es null con varianza cero o menos de 3 pares', () => {
    const m = matriz({ r1: [3, 1], r2: [3, 5], r3: [3, 2] }, { r1: [1, 1], r2: [5, 5], r3: [2, 2] });
    const c = correlacionPorPropuesta(m, porFuente('humano'), porFuente('avatar'));
    expect(c.porPropuesta.p1.r).toBeNull();
    expect(c.porPropuesta.p2.r).not.toBeNull();
    const m2 = matriz({ r1: [1, 1], r2: [5, 5] }, { r1: [1, 1], r2: [5, 5] });
    expect(correlacionPorPropuesta(m2, porFuente('humano'), porFuente('avatar')).porPropuesta.p1.r).toBeNull();
  });
});

describe('dispersion', () => {
  it('es la varianza poblacional por propuesta', () => {
    const m = matriz({ r1: [1, 3], r2: [5, 3] }, {});
    const d = dispersion(m, porFuente('humano'));
    expect(d.p1).toBeCloseTo(4);
    expect(d.p2).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/analitica/basico.test.ts"`
Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/avatares/analitica/basico.ts
import { aprueba, type Fuente, type Matriz, type Persona } from '../contrato';

export type FiltroPersona = (p: Persona) => boolean;

export function porFuente(f: Fuente, extra: Partial<Persona> = {}): FiltroPersona {
  return (p) => p.fuente === f && Object.entries(extra).every(([k, v]) => (p as unknown as Record<string, unknown>)[k] === v);
}

/** propuesta -> ref -> valor. Si una fuente tiene varias personas por ref (replicas), promedia. */
export function valoresPorPropuesta(m: Matriz, filtro: FiltroPersona): Map<string, Map<string, number>> {
  const personas = new Map(m.personas.filter(filtro).map((p) => [p.id, p]));
  const suma = new Map<string, Map<string, [number, number]>>();
  for (const v of m.votos) {
    const p = personas.get(v.persona);
    if (!p) continue;
    if (!suma.has(v.propuesta)) suma.set(v.propuesta, new Map());
    const porRef = suma.get(v.propuesta)!;
    const [s, n] = porRef.get(p.ref) ?? [0, 0];
    porRef.set(p.ref, [s + v.valor, n + 1]);
  }
  const out = new Map<string, Map<string, number>>();
  for (const prop of m.instrumento.propuestas) {
    const porRef = suma.get(prop.id) ?? new Map();
    out.set(prop.id, new Map([...porRef].map(([ref, [s, n]]) => [ref, s / n])));
  }
  return out;
}

export function aprobacion(m: Matriz, filtro: FiltroPersona) {
  const personas = new Set(m.personas.filter(filtro).map((p) => p.id));
  const out: Record<string, { aprueban: number; n: number; tasa: number }> = {};
  for (const prop of m.instrumento.propuestas) out[prop.id] = { aprueban: 0, n: 0, tasa: NaN };
  for (const v of m.votos) {
    if (!personas.has(v.persona) || !out[v.propuesta]) continue;
    out[v.propuesta].n += 1;
    if (aprueba(v.valor)) out[v.propuesta].aprueban += 1;
  }
  for (const k of Object.keys(out)) out[k].tasa = out[k].n ? out[k].aprueban / out[k].n : NaN;
  return out;
}

export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export function correlacionPorPropuesta(m: Matriz, filtroA: FiltroPersona, filtroB: FiltroPersona) {
  const A = valoresPorPropuesta(m, filtroA);
  const B = valoresPorPropuesta(m, filtroB);
  const refsA = new Set(m.personas.filter(filtroA).map((p) => p.ref));
  const refsB = new Set(m.personas.filter(filtroB).map((p) => p.ref));
  const refsSinPareja = [...refsA].filter((r) => !refsB.has(r)).length + [...refsB].filter((r) => !refsA.has(r)).length;
  const porPropuesta: Record<string, { r: number | null; n: number }> = {};
  const rs: number[] = [];
  for (const prop of m.instrumento.propuestas) {
    const a = A.get(prop.id)!, b = B.get(prop.id)!;
    const x: number[] = [], y: number[] = [];
    for (const [ref, va] of a) if (b.has(ref)) { x.push(va); y.push(b.get(ref)!); }
    const r = pearson(x, y);
    porPropuesta[prop.id] = { r, n: x.length };
    if (r !== null) rs.push(r);
  }
  return { porPropuesta, promedio: rs.length ? rs.reduce((s, v) => s + v, 0) / rs.length : null, refsSinPareja };
}

export function dispersion(m: Matriz, filtro: FiltroPersona): Record<string, number> {
  const V = valoresPorPropuesta(m, filtro);
  const out: Record<string, number> = {};
  for (const [prop, porRef] of V) {
    const xs = [...porRef.values()];
    if (!xs.length) { out[prop] = NaN; continue; }
    const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
    out[prop] = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatares/analitica/basico.ts src/lib/avatares/analitica/basico.test.ts
git commit -m "feat(avatares): aprobacion, correlacion pareada y dispersion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mapa común y grupos (M3b)

**Files:**
- Create: `src/lib/avatares/azar.ts`, `src/lib/avatares/analitica/mapa.ts`
- Test: `src/lib/avatares/analitica/mapa.test.ts`

**Interfaces:**
- Consumes: `Matriz`, `FiltroPersona`, `porFuente` (Tasks 1, 3)
- Produces:
  - `mulberry32(seed: number): () => number`
  - `interface PuntoMapa { personaId: string; ref: string; fuente: Fuente; x: number; y: number }`
  - `interface Mapa { puntos: PuntoMapa[]; cargas: { propuesta: string; x: number; y: number }[]; varianzaExplicada: [number, number]; degenerado: boolean }`
  - `mapaPCA(m: Matriz, ajustarCon?: FiltroPersona): Mapa` — ajusta con humanos (por defecto) y proyecta a todas las personas
  - `interface Grupos { k: number; asignacion: Record<string, number>; centroides: [number, number][]; silueta: number; degenerado: boolean }`
  - `grupos(puntos: { id: string; x: number; y: number }[], kMax?: number): Grupos` — k ∈ {2..min(kMax=4, distintos)}

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/avatares/analitica/mapa.test.ts
import { describe, expect, it } from 'vitest';
import type { Instrumento, Matriz, Persona, Voto } from '../contrato';
import { grupos, mapaPCA } from './mapa';
import { mulberry32 } from '../azar';

const props = ['p1', 'p2', 'p3', 'p4'];
const inst: Instrumento = {
  id: 't', version: 1, titulo: 't', escala: { min: 1, max: 5, aprueba: 4, etiquetas: ['1', '2', '3', '4', '5'] },
  planilla: [], propuestas: props.map((id) => ({ id, texto: id, origen: 'instrumento' as const })),
};

function conVotos(filas: { ref: string; fuente?: Persona['fuente']; v: number[] }[]): Matriz {
  const personas: Persona[] = [], votos: Voto[] = [];
  for (const f of filas) {
    const id = `${f.fuente ?? 'humano'}_${f.ref}`;
    personas.push({ id, ref: f.ref, fuente: f.fuente ?? 'humano', via: 'app' });
    f.v.forEach((valor, i) => { if (valor) votos.push({ persona: id, propuesta: props[i], valor }); });
  }
  return { instrumento: inst, personas, votos };
}

describe('mulberry32', () => {
  it('es determinista', () => {
    const a = mulberry32(7), b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('mapaPCA', () => {
  const izq = [5, 5, 1, 1], der = [1, 1, 5, 5];
  const filas = [
    ...Array.from({ length: 6 }, (_, i) => ({ ref: `i${i}`, v: izq.map((x, j) => (j === i % 4 ? Math.max(1, x - 1) : x)) })),
    ...Array.from({ length: 6 }, (_, i) => ({ ref: `d${i}`, v: der.map((x, j) => (j === i % 4 ? Math.max(1, x - 1) : x)) })),
  ];
  it('separa dos bandos en el primer eje y proyecta otras fuentes en el mismo espacio', () => {
    const m = conVotos([...filas, { ref: 'i0', fuente: 'avatar', v: izq }]);
    const mapa = mapaPCA(m);
    expect(mapa.degenerado).toBe(false);
    const xs = (pref: string) => mapa.puntos.filter((p) => p.fuente === 'humano' && p.ref.startsWith(pref)).map((p) => p.x);
    const signoI = Math.sign(xs('i')[0]);
    expect(xs('i').every((x) => Math.sign(x) === signoI)).toBe(true);
    expect(xs('d').every((x) => Math.sign(x) === -signoI)).toBe(true);
    const av = mapa.puntos.find((p) => p.fuente === 'avatar')!;
    expect(Math.sign(av.x)).toBe(signoI);
    expect(mapa.varianzaExplicada[0]).toBeGreaterThan(0.8);
    expect(mapa.cargas).toHaveLength(4);
  });
  it('imputa huecos con la media de la propuesta sin romperse', () => {
    const m = conVotos([...filas, { ref: 'hueco', v: [5, 0, 0, 1] }]);
    expect(mapaPCA(m).puntos.find((p) => p.ref === 'hueco')).toBeDefined();
  });
  it('N=3 o votos identicos: degenerado sin NaN', () => {
    const igual = conVotos([{ ref: 'a', v: [3, 3, 3, 3] }, { ref: 'b', v: [3, 3, 3, 3] }, { ref: 'c', v: [3, 3, 3, 3] }]);
    const mapa = mapaPCA(igual);
    expect(mapa.degenerado).toBe(true);
    expect(mapa.puntos.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });
});

describe('grupos', () => {
  it('encuentra dos grupos claros y es determinista', () => {
    const r = mulberry32(1);
    const pts = [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, x: -3 + r() * 0.5, y: r() * 0.5 })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, x: 3 + r() * 0.5, y: r() * 0.5 })),
    ];
    const g = grupos(pts);
    expect(g.k).toBe(2);
    expect(new Set(pts.slice(0, 8).map((p) => g.asignacion[p.id])).size).toBe(1);
    expect(g.asignacion.a0).not.toBe(g.asignacion.b0);
    expect(grupos(pts)).toEqual(g);
  });
  it('con menos de 2 puntos distintos devuelve un solo grupo degenerado', () => {
    const g = grupos([{ id: 'a', x: 1, y: 1 }, { id: 'b', x: 1, y: 1 }]);
    expect(g.k).toBe(1);
    expect(g.degenerado).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/analitica/mapa.test.ts"`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/avatares/azar.ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

```ts
// src/lib/avatares/analitica/mapa.ts
// El mapa latente de Evans y Weyl / Polis: PCA sobre la matriz de votos. Se
// ajusta con los humanos y TODAS las fuentes se proyectan en esas coordenadas,
// para que humanos, avatares y avatares en red se comparen en el mismo plano.
import type { Fuente, Matriz } from '../contrato';
import { mulberry32 } from '../azar';
import { porFuente, type FiltroPersona } from './basico';

export interface PuntoMapa { personaId: string; ref: string; fuente: Fuente; x: number; y: number }
export interface Mapa {
  puntos: PuntoMapa[];
  cargas: { propuesta: string; x: number; y: number }[];
  varianzaExplicada: [number, number];
  degenerado: boolean;
}

const EPS = 1e-9;

function filas(m: Matriz, ids: string[]): (number | null)[][] {
  const col = new Map(m.instrumento.propuestas.map((p, j) => [p.id, j]));
  const fila = new Map(ids.map((id, i) => [id, i]));
  const X: (number | null)[][] = ids.map(() => m.instrumento.propuestas.map(() => null));
  for (const v of m.votos) {
    const i = fila.get(v.persona), j = col.get(v.propuesta);
    if (i !== undefined && j !== undefined) X[i][j] = v.valor;
  }
  return X;
}

/** Primer vector propio de C (simetrica) por iteracion de potencia, determinista. */
function vectorPropio(C: number[][]): { v: number[]; lambda: number } {
  const d = C.length;
  let v = Array.from({ length: d }, (_, i) => 1 / Math.sqrt(d) + i * 1e-3);
  let lambda = 0;
  for (let it = 0; it < 500; it++) {
    const w = C.map((fila) => fila.reduce((s, c, j) => s + c * v[j], 0));
    const norma = Math.sqrt(w.reduce((s, x) => s + x * x, 0));
    if (norma < EPS) return { v: v.map(() => 0), lambda: 0 };
    const nv = w.map((x) => x / norma);
    lambda = norma;
    const delta = nv.reduce((s, x, j) => s + Math.abs(x - v[j]), 0);
    v = nv;
    if (delta < 1e-12) break;
  }
  // Signo fijo: la componente de mayor valor absoluto es positiva.
  const iMax = v.reduce((b, x, i) => (Math.abs(x) > Math.abs(v[b]) ? i : b), 0);
  if (v[iMax] < 0) v = v.map((x) => -x);
  return { v, lambda };
}

export function mapaPCA(m: Matriz, ajustarCon: FiltroPersona = porFuente('humano')): Mapa {
  const d = m.instrumento.propuestas.length;
  const ajuste = m.personas.filter(ajustarCon);
  const Xa = filas(m, ajuste.map((p) => p.id));
  const medias = Array.from({ length: d }, (_, j) => {
    const xs = Xa.map((f) => f[j]).filter((x): x is number => x !== null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 3;
  });
  const centrar = (f: (number | null)[]) => f.map((x, j) => (x === null ? 0 : x - medias[j]));
  const Za = Xa.map(centrar);
  const n = Math.max(Za.length, 1);
  const C = Array.from({ length: d }, (_, a) =>
    Array.from({ length: d }, (_, b) => Za.reduce((s, z) => s + z[a] * z[b], 0) / n));
  const traza = C.reduce((s, f, i) => s + f[i], 0);
  const e1 = vectorPropio(C);
  const C2 = C.map((f, a) => f.map((c, b) => c - e1.lambda * e1.v[a] * e1.v[b]));
  const e2 = vectorPropio(C2);
  const degenerado = ajuste.length < 4 || traza < EPS;
  const todas = m.personas;
  const Z = filas(m, todas.map((p) => p.id)).map(centrar);
  const puntos = todas.map((p, i) => ({
    personaId: p.id, ref: p.ref, fuente: p.fuente,
    x: Z[i].reduce((s, z, j) => s + z * e1.v[j], 0),
    y: Z[i].reduce((s, z, j) => s + z * e2.v[j], 0),
  }));
  return {
    puntos,
    cargas: m.instrumento.propuestas.map((p, j) => ({ propuesta: p.id, x: e1.v[j], y: e2.v[j] })),
    varianzaExplicada: traza < EPS ? [0, 0] : [e1.lambda / traza, e2.lambda / traza],
    degenerado,
  };
}

export interface Grupos {
  k: number;
  asignacion: Record<string, number>;
  centroides: [number, number][];
  silueta: number;
  degenerado: boolean;
}

type P = { id: string; x: number; y: number };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function kmeans(pts: P[], k: number, seed: number): { asig: number[]; cents: [number, number][] } {
  const r = mulberry32(seed);
  const cents: [number, number][] = [[pts[0].x, pts[0].y]];
  while (cents.length < k) {
    // k-means++ determinista: el siguiente centro con probabilidad proporcional a d^2.
    const d2 = pts.map((p) => Math.min(...cents.map(([cx, cy]) => (p.x - cx) ** 2 + (p.y - cy) ** 2)));
    const tot = d2.reduce((a, b) => a + b, 0);
    let u = r() * tot, i = 0;
    while (i < pts.length - 1 && u > d2[i]) { u -= d2[i]; i++; }
    cents.push([pts[i].x, pts[i].y]);
  }
  let asig = pts.map(() => 0);
  for (let it = 0; it < 100; it++) {
    const nueva = pts.map((p) => cents.reduce((b, c, j) => (dist(p, { x: c[0], y: c[1] }) < dist(p, { x: cents[b][0], y: cents[b][1] }) ? j : b), 0));
    for (let j = 0; j < k; j++) {
      const miembros = pts.filter((_, i) => nueva[i] === j);
      if (miembros.length) cents[j] = [miembros.reduce((s, p) => s + p.x, 0) / miembros.length, miembros.reduce((s, p) => s + p.y, 0) / miembros.length];
    }
    const igual = nueva.every((a, i) => a === asig[i]);
    asig = nueva;
    if (igual && it > 0) break;
  }
  return { asig, cents };
}

function silueta(pts: P[], asig: number[], k: number): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const propio = pts.filter((_, j) => j !== i && asig[j] === asig[i]);
    if (!propio.length) continue;
    const a = propio.reduce((t, q) => t + dist(pts[i], q), 0) / propio.length;
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === asig[i]) continue;
      const otros = pts.filter((_, j) => asig[j] === c);
      if (otros.length) b = Math.min(b, otros.reduce((t, q) => t + dist(pts[i], q), 0) / otros.length);
    }
    if (Number.isFinite(b)) s += (b - a) / Math.max(a, b, EPS);
  }
  return s / pts.length;
}

export function grupos(puntos: P[], kMax = 4): Grupos {
  const distintos = new Set(puntos.map((p) => `${p.x.toFixed(9)},${p.y.toFixed(9)}`)).size;
  const tope = Math.min(kMax, distintos, Math.floor(puntos.length / 2));
  if (tope < 2) {
    const cx = puntos.reduce((s, p) => s + p.x, 0) / Math.max(puntos.length, 1);
    const cy = puntos.reduce((s, p) => s + p.y, 0) / Math.max(puntos.length, 1);
    return { k: 1, asignacion: Object.fromEntries(puntos.map((p) => [p.id, 0])), centroides: [[cx, cy]], silueta: 0, degenerado: true };
  }
  let mejor: Grupos | null = null;
  for (let k = 2; k <= tope; k++) {
    const { asig, cents } = kmeans(puntos, k, 20261109 + k);
    const s = silueta(puntos, asig, k);
    if (!mejor || s > mejor.silueta + 1e-12) {
      mejor = { k, asignacion: Object.fromEntries(puntos.map((p, i) => [p.id, asig[i]])), centroides: cents.map((c) => [c[0], c[1]] as [number, number]), silueta: s, degenerado: false };
    }
  }
  return mejor!;
}
```

- [ ] **Step 4: Run test to verify it passes** — same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatares/azar.ts src/lib/avatares/analitica/mapa.ts src/lib/avatares/analitica/mapa.test.ts
git commit -m "feat(avatares): mapa PCA comun y grupos por k-means con silueta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Puentes: Polis, Community Notes, rankings e inundación (M3c)

**Files:**
- Create: `src/lib/avatares/analitica/puentes.ts`
- Test: `src/lib/avatares/analitica/puentes.test.ts`

**Interfaces:**
- Consumes: `Matriz`, `Persona`, `idBot`, `aprueba` (Task 1); `FiltroPersona`, `porFuente`, `aprobacion` (Task 3); `mapaPCA`, `grupos` (Task 4)
- Produces:
  - `puentePolis(m: Matriz, filtro: FiltroPersona, asignacion: Record<string /* personaId */, number>): Record<string, { minimo: number; producto: number; porGrupo: number[] }>`
  - `interface ResultadoCN { mu: number; propuestas: Record<string, { intercepto: number; factor: number }>; personas: Record<string, { intercepto: number; factor: number }> }`
  - `factorizacionCN(m: Matriz, filtro: FiltroPersona, opts?: { lambdaI?: number; lambdaF?: number; iter?: number }): ResultadoCN`
  - `interface Rankings { mayoria: string[]; puenteCN: string[]; puentePolis: string[]; grupos: Grupos }`
  - `rankings(m: Matriz, filtro: FiltroPersona): Rankings` — los grupos se detectan con el mapa de esa misma fuente
  - `inundar(m: Matriz, personaId: string, n: number): Matriz` — agrega n copias `fuente: 'bot'`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/avatares/analitica/puentes.test.ts
import { describe, expect, it } from 'vitest';
import type { Instrumento, Matriz, Persona, Voto } from '../contrato';
import { aprobacion, porFuente } from './basico';
import { factorizacionCN, inundar, puentePolis, rankings } from './puentes';

// Dos bandos de distinto tamano: A (14) y B (6).
// P1: A ama, B odia (70 % aprueba). P2: B ama, A odia. P4: A ama, B tibio.
// P3: PUENTE: 13 de 20 aprueban (65 %), repartidos en ambos bandos.
const props = ['p1', 'p2', 'p3', 'p4'];
const inst: Instrumento = {
  id: 't', version: 1, titulo: 't', escala: { min: 1, max: 5, aprueba: 4, etiquetas: ['1', '2', '3', '4', '5'] },
  planilla: [], propuestas: props.map((id) => ({ id, texto: id, origen: 'instrumento' as const })),
};
function construir(): Matriz {
  const personas: Persona[] = [], votos: Voto[] = [];
  const add = (ref: string, v: number[]) => {
    const id = `h_${ref}`;
    personas.push({ id, ref, fuente: 'humano', via: 'app' });
    v.forEach((valor, j) => votos.push({ persona: id, propuesta: props[j], valor }));
  };
  for (let i = 0; i < 14; i++) add(`a${i}`, [5, 1, i < 9 ? 4 : 3, i % 2 ? 5 : 4]);
  for (let i = 0; i < 6; i++) add(`b${i}`, [1, 5, i < 4 ? 4 : 3, 2]);
  return { instrumento: inst, personas, votos };
}

describe('puentePolis', () => {
  it('el minimo entre grupos premia la propuesta puente y castiga la polarizada', () => {
    const m = construir();
    const asig = Object.fromEntries(m.personas.map((p) => [p.id, p.ref.startsWith('a') ? 0 : 1]));
    const r = puentePolis(m, porFuente('humano'), asig);
    expect(r.p3.minimo).toBeCloseTo(0.625);
    expect(r.p1.minimo).toBeCloseTo(0.125);
    expect(r.p3.minimo).toBeGreaterThan(r.p1.minimo);
    expect(r.p3.porGrupo).toHaveLength(2);
  });
  it('un grupo sin votos en una propuesta no revienta (suavizado de Laplace)', () => {
    const m = construir();
    const asig = Object.fromEntries(m.personas.map((p) => [p.id, p.ref.startsWith('a') ? 0 : 1]));
    const sinB = { ...m, votos: m.votos.filter((v) => !(v.propuesta === 'p4' && v.persona.startsWith('h_b'))) };
    expect(puentePolis(sinB, porFuente('humano'), asig).p4.minimo).toBeCloseTo(0.5);
  });
});

describe('factorizacionCN', () => {
  it('la mayoria pone primero a P1; el intercepto pone primero a P3', () => {
    const m = construir();
    const ap = aprobacion(m, porFuente('humano'));
    expect(ap.p1.tasa).toBeGreaterThan(ap.p3.tasa);
    const cn = factorizacionCN(m, porFuente('humano'));
    const orden = Object.entries(cn.propuestas).sort((a, b) => b[1].intercepto - a[1].intercepto).map(([k]) => k);
    expect(orden[0]).toBe('p3');
    expect(Math.abs(cn.propuestas.p1.factor)).toBeGreaterThan(Math.abs(cn.propuestas.p3.factor));
  });
  it('es determinista y sin NaN', () => {
    const m = construir();
    const a = factorizacionCN(m, porFuente('humano')), b = factorizacionCN(m, porFuente('humano'));
    expect(a).toEqual(b);
    expect(Object.values(a.propuestas).every((p) => Number.isFinite(p.intercepto) && Number.isFinite(p.factor))).toBe(true);
  });
});

describe('rankings', () => {
  it('detecta los grupos solo y ordena distinto por mayoria y por puente', () => {
    const r = rankings(construir(), porFuente('humano'));
    expect(r.grupos.k).toBeGreaterThanOrEqual(2);
    expect(r.mayoria[0]).toBe('p1');
    expect(r.puenteCN[0]).toBe('p3');
    expect(r.puentePolis[0]).toBe('p3');
  });
});

describe('inundar', () => {
  it('agrega copias identicas como bots, sin tocar el original', () => {
    const m = construir();
    const m2 = inundar(m, 'h_a0', 10);
    expect(m2.personas.filter((p) => p.fuente === 'bot')).toHaveLength(10);
    expect(m2.votos.length).toBe(m.votos.length + 40);
    expect(m.personas).toHaveLength(20);
  });
  it('los bots mueven la mayoria mas que el intercepto', () => {
    const m = construir();
    // Copiar a un miembro de B: empuja P2 (polarizada).
    const m2 = inundar(m, 'h_b0', 15);
    const todos = (p: Persona) => p.fuente === 'humano' || p.fuente === 'bot';
    const dMay = aprobacion(m2, todos).p2.tasa - aprobacion(m, porFuente('humano')).p2.tasa;
    const dCN = factorizacionCN(m2, todos).propuestas.p2.intercepto - factorizacionCN(m, porFuente('humano')).propuestas.p2.intercepto;
    expect(dMay).toBeGreaterThan(0.2);
    expect(dCN).toBeLessThan(dMay);
  });
  it('n=0 devuelve una matriz equivalente', () => {
    const m = construir();
    expect(inundar(m, 'h_a0', 0).votos).toHaveLength(m.votos.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/analitica/puentes.test.ts"`
Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/avatares/analitica/puentes.ts
// Mayoria contra puente. Dos reglas puente:
//  - Polis: aprobacion suavizada (a+1)/(n+2) en cada grupo detectado; minimo y producto.
//  - Community Notes: r = mu + i_persona + i_propuesta + f_persona * f_propuesta, factor de 1
//    dimension, valores (v-1)/4, lambda_i = 0.15 y lambda_f = 0.03 (twitter/communitynotes,
//    documentation/under-the-hood/ranking-notes.md). El intercepto de la propuesta es el apoyo
//    que no explica el bando: el puntaje puente. Personas y propuestas quedan en el mismo eje.
import { aprueba, idBot, type Matriz, type Persona, type Voto } from '../contrato';
import { aprobacion, type FiltroPersona } from './basico';
import { grupos, mapaPCA, type Grupos } from './mapa';

export function puentePolis(m: Matriz, filtro: FiltroPersona, asignacion: Record<string, number>) {
  const personas = new Set(m.personas.filter(filtro).map((p) => p.id));
  const kGrupos = Math.max(0, ...Object.values(asignacion)) + 1;
  const out: Record<string, { minimo: number; producto: number; porGrupo: number[] }> = {};
  for (const prop of m.instrumento.propuestas) {
    const a = Array(kGrupos).fill(0), n = Array(kGrupos).fill(0);
    for (const v of m.votos) {
      if (v.propuesta !== prop.id || !personas.has(v.persona)) continue;
      const g = asignacion[v.persona];
      if (g === undefined) continue;
      n[g] += 1;
      if (aprueba(v.valor)) a[g] += 1;
    }
    const porGrupo = a.map((ag, g) => (ag + 1) / (n[g] + 2));
    out[prop.id] = { minimo: Math.min(...porGrupo), producto: porGrupo.reduce((s, x) => s * x, 1), porGrupo };
  }
  return out;
}

export interface ResultadoCN {
  mu: number;
  propuestas: Record<string, { intercepto: number; factor: number }>;
  personas: Record<string, { intercepto: number; factor: number }>;
}

export function factorizacionCN(
  m: Matriz, filtro: FiltroPersona, opts: { lambdaI?: number; lambdaF?: number; iter?: number } = {},
): ResultadoCN {
  const lI = opts.lambdaI ?? 0.15, lF = opts.lambdaF ?? 0.03, iter = opts.iter ?? 300;
  const personas = m.personas.filter(filtro).map((p) => p.id);
  const pIdx = new Map(personas.map((id, i) => [id, i]));
  const props = m.instrumento.propuestas.map((p) => p.id);
  const qIdx = new Map(props.map((id, j) => [id, j]));
  const R = m.votos
    .filter((v) => pIdx.has(v.persona) && qIdx.has(v.propuesta))
    .map((v) => ({ u: pIdx.get(v.persona)!, n: qIdx.get(v.propuesta)!, r: (v.valor - 1) / 4 }));
  const iu = new Array(personas.length).fill(0), inn = new Array(props.length).fill(0);
  // Inicializacion determinista y no simetrica de los factores.
  const fu = personas.map((_, i) => 0.1 * Math.sin(i + 1));
  const fn = props.map((_, j) => 0.1 * Math.cos(j + 1));
  let mu = 0;
  const porU = personas.map(() => [] as typeof R), porN = props.map(() => [] as typeof R);
  for (const x of R) { porU[x.u].push(x); porN[x.n].push(x); }
  for (let it = 0; it < iter; it++) {
    mu = R.reduce((s, x) => s + (x.r - iu[x.u] - inn[x.n] - fu[x.u] * fn[x.n]), 0) / (R.length + lI);
    for (let u = 0; u < personas.length; u++)
      iu[u] = porU[u].reduce((s, x) => s + (x.r - mu - inn[x.n] - fu[u] * fn[x.n]), 0) / (porU[u].length + lI);
    for (let n = 0; n < props.length; n++)
      inn[n] = porN[n].reduce((s, x) => s + (x.r - mu - iu[x.u] - fu[x.u] * fn[n]), 0) / (porN[n].length + lI);
    for (let u = 0; u < personas.length; u++) {
      const num = porU[u].reduce((s, x) => s + fn[x.n] * (x.r - mu - iu[u] - inn[x.n]), 0);
      const den = porU[u].reduce((s, x) => s + fn[x.n] ** 2, 0) + lF;
      fu[u] = num / den;
    }
    for (let n = 0; n < props.length; n++) {
      const num = porN[n].reduce((s, x) => s + fu[x.u] * (x.r - mu - iu[x.u] - inn[n]), 0);
      const den = porN[n].reduce((s, x) => s + fu[x.u] ** 2, 0) + lF;
      fn[n] = num / den;
    }
  }
  // Signo fijo: la propuesta de mayor |factor| queda positiva.
  const jMax = fn.reduce((b, x, j) => (Math.abs(x) > Math.abs(fn[b]) ? j : b), 0);
  const s = fn[jMax] < 0 ? -1 : 1;
  return {
    mu,
    propuestas: Object.fromEntries(props.map((id, j) => [id, { intercepto: inn[j], factor: s * fn[j] }])),
    personas: Object.fromEntries(personas.map((id, i) => [id, { intercepto: iu[i], factor: s * fu[i] }])),
  };
}

export interface Rankings { mayoria: string[]; puenteCN: string[]; puentePolis: string[]; grupos: Grupos }

const ordenar = (xs: Record<string, number>) =>
  Object.entries(xs).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);

export function rankings(m: Matriz, filtro: FiltroPersona): Rankings {
  const mapa = mapaPCA(m, filtro);
  const ids = new Set(m.personas.filter(filtro).map((p) => p.id));
  const g = grupos(mapa.puntos.filter((p) => ids.has(p.personaId)).map((p) => ({ id: p.personaId, x: p.x, y: p.y })));
  const ap = aprobacion(m, filtro);
  const cn = factorizacionCN(m, filtro);
  const polis = puentePolis(m, filtro, g.asignacion);
  return {
    mayoria: ordenar(Object.fromEntries(Object.entries(ap).map(([k, v]) => [k, Number.isNaN(v.tasa) ? -1 : v.tasa]))),
    puenteCN: ordenar(Object.fromEntries(Object.entries(cn.propuestas).map(([k, v]) => [k, v.intercepto]))),
    puentePolis: ordenar(Object.fromEntries(Object.entries(polis).map(([k, v]) => [k, v.minimo]))),
    grupos: g,
  };
}

export function inundar(m: Matriz, personaId: string, n: number): Matriz {
  const original = m.personas.find((p) => p.id === personaId);
  if (!original || n <= 0) return { ...m, personas: [...m.personas], votos: [...m.votos] };
  const suyos = m.votos.filter((v) => v.persona === personaId);
  const personas: Persona[] = [...m.personas];
  const votos: Voto[] = [...m.votos];
  for (let i = 0; i < n; i++) {
    const id = idBot(i, original.ref);
    personas.push({ id, ref: `${original.ref}_bot${i}`, fuente: 'bot', via: 'simulado', condicion: `copia de ${personaId}` });
    for (const v of suyos) votos.push({ persona: id, propuesta: v.propuesta, valor: v.valor });
  }
  return { ...m, personas, votos };
}
```

- [ ] **Step 4: Run test to verify it passes** — same command. Expected: PASS. Si `factorizacionCN` no pone a P3 primero, depurar la factorización (signos, residuos); **no** cambiar los datos de la prueba ni las constantes λ.

- [ ] **Step 5: Commit**

```bash
git add src/lib/avatares/analitica/puentes.ts src/lib/avatares/analitica/puentes.test.ts
git commit -m "feat(avatares): reglas puente de Polis y Community Notes, rankings e inundacion con bots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Datos sintéticos (M6)

**Files:**
- Create: `content/avatares/fixtures/panel_estudiantes_v1.json` (copia de `C:\Users\naim.bro.k\claude_projects\mirofish\projects\oleadas\panel_estudiantes_v1.json`; es sintético)
- Create: `src/lib/avatares/sinteticos.ts`
- Test: `src/lib/avatares/sinteticos.test.ts`

**Interfaces:**
- Consumes: `Instrumento`, `Matriz`, `Persona`, `Voto`, ids (Task 1); `Planilla` (Task 2); `mulberry32` (Task 4); `dispersion`, `correlacionPorPropuesta`, `porFuente` (Task 3)
- Produces:
  - `interface OpcionesSinteticas { semilla?: number; n?: number; corrimiento?: number; contraccion?: number; contraccionRed?: number; replicas?: number }`
  - `sintetizar(inst: Instrumento, opts?: OpcionesSinteticas): { matriz: Matriz; planillas: Record<string, Planilla> }` — humanos, `avatar` (via `simulado`, modelo `sintetico`), y `avatar_red` (réplicas 1..r)

- [ ] **Step 1: Copiar el fixture**

```bash
cp /c/Users/naim.bro.k/claude_projects/mirofish/projects/oleadas/panel_estudiantes_v1.json content/avatares/fixtures/panel_estudiantes_v1.json
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/avatares/sinteticos.test.ts
import { describe, expect, it } from 'vitest';
import { validarMatriz } from './contrato';
import { instrumentoDe } from './instrumentos';
import { sintetizar } from './sinteticos';
import { correlacionPorPropuesta, dispersion, porFuente } from './analitica/basico';

const inst = instrumentoDe('ayd14_vina_v1')!;

describe('sintetizar', () => {
  const { matriz, planillas } = sintetizar(inst, { semilla: 3, n: 30, replicas: 3 });
  it('produce una matriz valida y determinista', () => {
    expect(validarMatriz(matriz)).toEqual([]);
    expect(sintetizar(inst, { semilla: 3, n: 30, replicas: 3 }).matriz).toEqual(matriz);
  });
  it('tiene 30 humanos, 30 avatares y 3x30 avatares en red', () => {
    expect(matriz.personas.filter((p) => p.fuente === 'humano')).toHaveLength(30);
    expect(matriz.personas.filter((p) => p.fuente === 'avatar')).toHaveLength(30);
    expect(matriz.personas.filter((p) => p.fuente === 'avatar_red')).toHaveLength(90);
    expect(Object.keys(planillas)).toHaveLength(30);
  });
  it('los avatares en red estan mas homogeneos que los avatares, y estos que los humanos', () => {
    const media = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0) / Object.values(r).length;
    const h = media(dispersion(matriz, porFuente('humano')));
    const a = media(dispersion(matriz, porFuente('avatar')));
    const red = media(dispersion(matriz, porFuente('avatar_red', { replica: 1 })));
    expect(a).toBeLessThan(h);
    expect(red).toBeLessThan(a);
  });
  it('avatar y humano se correlacionan positivamente', () => {
    const c = correlacionPorPropuesta(matriz, porFuente('humano'), porFuente('avatar'));
    expect(c.promedio!).toBeGreaterThan(0.3);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/sinteticos.test.ts"`
Expected: FAIL, módulo inexistente.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/avatares/sinteticos.ts
// Datos sinteticos para probar toda la cadena sin alumnos (spec M6). Parte del
// panel sintetico de MiroFish (40 estudiantes inventados). Los avatares tienen
// sesgos conocidos y configurables: corrimiento progresista (Toubia et al. 2025,
// «blue shift») y menos varianza; los avatares en red, todavia mas homogeneos.
import panel from '../../../content/avatares/fixtures/panel_estudiantes_v1.json';
import { mulberry32 } from './azar';
import { idAvatar, idHumano, idMirofishRed, type Instrumento, type Matriz, type Persona, type Voto } from './contrato';
import type { Planilla } from './planilla';

export interface OpcionesSinteticas {
  semilla?: number; n?: number; corrimiento?: number; contraccion?: number; contraccionRed?: number; replicas?: number;
}

const IDEOLOGIA: Record<string, number> = {
  Izquierda: -1, 'Centro-izquierda': -0.5, Centro: 0, 'Centro-derecha': 0.5, Derecha: 1, Ninguna: 0,
};
// Signo de cada propuesta: +1 si la apoya la izquierda. Las de representacion/ciencia son transversales (0).
const SIGNO: Record<string, number> = {
  salario_minimo: 1, estado_servicios: 1, impuestos_ricos: 1, matrimonio_igualitario: 1, aborto: 1, migracion: 1,
  cambio_climatico: 1, areas_protegidas: 1, regular_ia: 0.5, representantes_humanos: 0, referendos: 0.3, ciencia_democracia: 0,
};

const acotar = (x: number) => Math.min(5, Math.max(1, Math.round(x)));

export function sintetizar(inst: Instrumento, opts: OpcionesSinteticas = {}) {
  const { semilla = 1, n = 30, corrimiento = 0.4, contraccion = 0.6, contraccionRed = 0.35, replicas = 3 } = opts;
  const r = mulberry32(semilla);
  const ruido = () => (r() + r() + r() - 1.5) * 1.2;
  const gente = (panel as { personas: { id: string; posicion_politica: string; edad: number; sexo: string; ocupacion: string }[] }).personas.slice(0, n);
  const personas: Persona[] = [];
  const votos: Voto[] = [];
  const planillas: Record<string, Planilla> = {};
  const media = 3;
  for (const g of gente) {
    const ref = `s${g.id.toLowerCase()}`;
    const x = (IDEOLOGIA[g.posicion_politica] ?? 0) + ruido() * 0.5;
    planillas[ref] = {
      edad: String(g.edad), genero: g.sexo, ocupacion: g.ocupacion,
      economia: x < -0.3 ? 'izquierda redistributiva' : x > 0.3 ? 'derecha liberal de mercado' : 'centro',
      rol_estado: x < -0.3 ? 'fuerte intervención' : x > 0.3 ? 'mínimo' : 'equilibrado',
    };
    const humano: Record<string, number> = {};
    personas.push({ id: idHumano(ref), ref, fuente: 'humano', via: 'simulado' });
    for (const p of inst.propuestas) {
      const v = acotar(media - 1.6 * x * (SIGNO[p.id] ?? 0) + ruido());
      humano[p.id] = v;
      votos.push({ persona: idHumano(ref), propuesta: p.id, valor: v });
    }
    const aId = idAvatar('sintetico', ref);
    personas.push({ id: aId, ref, fuente: 'avatar', via: 'simulado', modelo: 'sintetico' });
    const avatar: Record<string, number> = {};
    for (const p of inst.propuestas) {
      const centro = media + corrimiento * (SIGNO[p.id] ?? 0);
      const v = acotar(centro + contraccion * (humano[p.id] - media) + ruido() * 0.4);
      avatar[p.id] = v;
      votos.push({ persona: aId, propuesta: p.id, valor: v });
    }
    for (let k = 1; k <= replicas; k++) {
      const id = idMirofishRed(k, ref);
      personas.push({ id, ref, fuente: 'avatar_red', via: 'simulado', modelo: 'sintetico', replica: k });
      for (const p of inst.propuestas) {
        const centro = media + 1.2 * corrimiento * (SIGNO[p.id] ?? 0);
        votos.push({ persona: id, propuesta: p.id, valor: acotar(centro + contraccionRed * (avatar[p.id] - media) + ruido() * 0.2) });
      }
    }
  }
  const matriz: Matriz = { instrumento: inst, personas, votos };
  return { matriz, planillas };
}
```

- [ ] **Step 5: Run test to verify it passes** — same command. Expected: PASS. Si la desigualdad de dispersión falla por el redondeo, bajar `contraccionRed` por defecto a 0,25 (es un parámetro del simulador, no del análisis).

- [ ] **Step 6: Commit**

```bash
git add content/avatares/fixtures src/lib/avatares/sinteticos.ts src/lib/avatares/sinteticos.test.ts
git commit -m "feat(avatares): datos sinteticos con sesgos conocidos para ensayar sin alumnos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Firestore: reglas, servicio de la sala y conversión a matriz (M1 datos)

**Files:**
- Modify: `firestore.rules` (agregar bloque `avataresRuns` después del bloque `compas/{courseId}/...`)
- Create: `scripts/test-avatares-rules.mjs`
- Modify: `package.json` (script `test:rules`)
- Create: `src/lib/avatares/sala.ts`
- Test: `src/lib/avatares/sala.test.ts` (solo lo puro: `aMatriz`, `codigoNuevo`)

**Interfaces:**
- Consumes: contrato (Task 1), `Planilla`, `planillaComoTexto` (Task 2)
- Produces:
  - `type Fase = 'lobby' | 'planilla' | 'encuesta' | 'resultados'`
  - `interface ModeloAvatar { provider: 'openai' | 'anthropic' | 'gemini'; model: string }`
  - `interface AvataresRun { code: string; hostId: string; courseId: string; instrumentoId: string; instrumento: Instrumento; fase: Fase; modelos: ModeloAvatar[]; participantes: Record<string, { inscrito?: boolean; planilla?: boolean; votos?: number }>; avatares?: { estado: 'corriendo' | 'listo' | 'error'; n: number; fallos: string[] } }`
  - `interface DocPlanilla { uid: string; ref: string; campos: Planilla; texto: string }` en `avataresRuns/{code}/planillas/{uid}`
  - `interface DocHumano { uid: string; ref: string; votos: Record<string, number> }` en `avataresRuns/{code}/humanos/{uid}`
  - `interface DocPersona extends Persona { votos: Record<string, number>; faltantes?: string[] }` en `avataresRuns/{code}/personas/{personaId}` (solo admin/Functions escriben)
  - `codigoNuevo(r?: () => number): string` (6 caracteres A–Z sin O/I + 2–9)
  - `aMatriz(inst: Instrumento, humanos: DocHumano[], personas: DocPersona[]): Matriz`
  - Firestore (no testeado en Vitest; probado por reglas y en el ensayo): `crearSala(hostId, instrumentoId, modelos)`, `inscribirse(code, uid)`, `guardarPlanilla(code, uid, campos)`, `guardarVoto(code, uid, propuestaId, valor)`, `cambiarFase(code, fase)`

- [ ] **Step 1: Write the failing test (lo puro)**

```ts
// src/lib/avatares/sala.test.ts
import { describe, expect, it } from 'vitest';
import { validarMatriz } from './contrato';
import { instrumentoDe } from './instrumentos';
import { aMatriz, codigoNuevo } from './sala';
import { mulberry32 } from './azar';

const inst = instrumentoDe('ayd14_vina_v1')!;

describe('aMatriz', () => {
  it('convierte humanos y personas al contrato, con huecos', () => {
    const m = aMatriz(inst,
      [{ uid: 'u1', ref: 'r1', votos: { salario_minimo: 5, aborto: 2 } }, { uid: 'u2', ref: 'r2', votos: {} }],
      [{ id: 'a_m_r1', ref: 'r1', fuente: 'avatar', via: 'app', modelo: 'm', votos: { salario_minimo: 4 } }]);
    expect(validarMatriz(m)).toEqual([]);
    expect(m.personas.map((p) => p.id)).toEqual(['h_r1', 'h_r2', 'a_m_r1']);
    expect(m.votos).toHaveLength(3);
    expect(JSON.stringify(m)).not.toContain('u1');
  });
  it('descarta votos a propuestas que no estan en el instrumento y valores invalidos', () => {
    const m = aMatriz(inst, [{ uid: 'u1', ref: 'r1', votos: { nope: 3, aborto: 9, migracion: 3 } }], []);
    expect(m.votos).toEqual([{ persona: 'h_r1', propuesta: 'migracion', valor: 3 }]);
  });
});

describe('codigoNuevo', () => {
  it('6 caracteres legibles y determinista con semilla', () => {
    const c = codigoNuevo(mulberry32(1));
    expect(c).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(codigoNuevo(mulberry32(1))).toBe(c);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/sala.test.ts"`
Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Implementar `sala.ts`**

```ts
// src/lib/avatares/sala.ts
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { idHumano, refDe, type Instrumento, type Matriz, type Persona, type Voto } from './contrato';
import { instrumentoDe, INSTRUMENTOS } from './instrumentos';
import { planillaComoTexto, type Planilla } from './planilla';

export type Fase = 'lobby' | 'planilla' | 'encuesta' | 'resultados';
export interface ModeloAvatar { provider: 'openai' | 'anthropic' | 'gemini'; model: string }
export interface AvataresRun {
  code: string; hostId: string; courseId: string; instrumentoId: string; instrumento: Instrumento; fase: Fase;
  modelos: ModeloAvatar[];
  participantes: Record<string, { inscrito?: boolean; planilla?: boolean; votos?: number }>;
  avatares?: { estado: 'corriendo' | 'listo' | 'error'; n: number; fallos: string[] };
}
export interface DocPlanilla { uid: string; ref: string; campos: Planilla; texto: string }
export interface DocHumano { uid: string; ref: string; votos: Record<string, number> }
export interface DocPersona extends Persona { votos: Record<string, number>; faltantes?: string[] }

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codigoNuevo(r: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => ALFABETO[Math.floor(r() * ALFABETO.length)]).join('');
}

export function aMatriz(inst: Instrumento, humanos: DocHumano[], personas: DocPersona[]): Matriz {
  const validas = new Set(inst.propuestas.map((p) => p.id));
  const ok = (prop: string, v: unknown) => validas.has(prop) && Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
  const ps: Persona[] = [];
  const vs: Voto[] = [];
  for (const h of humanos) {
    const id = idHumano(h.ref);
    ps.push({ id, ref: h.ref, fuente: 'humano', via: 'app' });
    for (const [prop, v] of Object.entries(h.votos ?? {})) if (ok(prop, v)) vs.push({ persona: id, propuesta: prop, valor: v });
  }
  for (const p of personas) {
    const { votos, faltantes: _f, ...persona } = p;
    ps.push(persona);
    for (const [prop, v] of Object.entries(votos ?? {})) if (ok(prop, v)) vs.push({ persona: p.id, propuesta: prop, valor: v });
  }
  return { instrumento: inst, personas: ps, votos: vs };
}

export async function crearSala(hostId: string, instrumentoId: string, modelos: ModeloAvatar[]): Promise<string> {
  const pack = INSTRUMENTOS[instrumentoId];
  if (!pack) throw new Error(`instrumento desconocido: ${instrumentoId}`);
  for (let intento = 0; intento < 5; intento++) {
    const code = codigoNuevo();
    const ref = doc(db, 'avataresRuns', code);
    if ((await getDoc(ref)).exists()) continue;
    await setDoc(ref, {
      code, hostId, courseId: pack.courseId, instrumentoId, instrumento: pack.instrumento, fase: 'lobby',
      modelos, participantes: {}, creadoEn: serverTimestamp(),
    });
    return code;
  }
  throw new Error('no se pudo generar un codigo libre');
}

export async function inscribirse(code: string, uid: string) {
  await updateDoc(doc(db, 'avataresRuns', code), { [`participantes.${uid}.inscrito`]: true });
}

export async function guardarPlanilla(code: string, uid: string, campos: Planilla) {
  const inst = instrumentoDe((await getDoc(doc(db, 'avataresRuns', code))).data()?.instrumentoId) ?? null;
  if (!inst) throw new Error('sala sin instrumento');
  const d: DocPlanilla = { uid, ref: refDe(uid, code), campos, texto: planillaComoTexto(inst, campos) };
  await setDoc(doc(db, 'avataresRuns', code, 'planillas', uid), d);
  await updateDoc(doc(db, 'avataresRuns', code), { [`participantes.${uid}.planilla`]: true });
}

export async function guardarVoto(code: string, uid: string, propuestaId: string, valor: number, totalVotados: number) {
  await setDoc(doc(db, 'avataresRuns', code, 'humanos', uid),
    { uid, ref: refDe(uid, code), votos: { [propuestaId]: valor } }, { merge: true });
  await updateDoc(doc(db, 'avataresRuns', code), { [`participantes.${uid}.votos`]: totalVotados });
}

export async function cambiarFase(code: string, fase: Fase) {
  await updateDoc(doc(db, 'avataresRuns', code), { fase });
}
```

- [ ] **Step 4: Run the unit test** — same command as Step 2. Expected: PASS.

- [ ] **Step 5: Agregar las reglas** (en `firestore.rules`, después del bloque `match /compas/{courseId}/{aplicacion}/{playerId} { ... }`)

```
    // ---------------------------------------------------------------------
    // Avatares (Semana 14 AyD). Spec 2026-11-07. No es un juego: no puntua.
    // Planillas y votos humanos los lee SOLO el anfitrion; las personas
    // (avatares, MiroFish) las escriben solo Functions y scripts de admin.
    // ---------------------------------------------------------------------
    match /avataresRuns/{code} {
      allow read: if isAuthenticated();
      allow create: if isApprovedProfessor() && request.resource.data.hostId == request.auth.uid;
      // Alumnos: solo su propia entrada en participantes. Anfitrion: todo.
      allow update: if isAuthenticated() && (
        resource.data.hostId == request.auth.uid
        || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participantes'])
      );
      allow delete: if isAdmin() || (isAuthenticated() && resource.data.hostId == request.auth.uid);

      function esHost(code) {
        return get(/databases/$(database)/documents/avataresRuns/$(code)).data.hostId == request.auth.uid;
      }

      match /planillas/{uid} {
        allow read: if isOwner(uid) || (isAuthenticated() && esHost(code));
        allow create, update: if isOwner(uid) && request.resource.data.uid == request.auth.uid;
        allow delete: if false;
      }
      match /humanos/{uid} {
        allow read: if isOwner(uid) || (isAuthenticated() && esHost(code));
        allow create, update: if isOwner(uid) && request.resource.data.uid == request.auth.uid;
        allow delete: if false;
      }
      match /personas/{personaId} {
        allow read: if isAuthenticated() && esHost(code);
        allow write: if false;
      }
    }
```

- [ ] **Step 6: Escribir las pruebas de reglas**

```js
// scripts/test-avatares-rules.mjs
// Reglas de avatares contra el emulador (npm run test:rules). Lo que importa y
// no se puede probar jugando solo: el ANFITRION lee la planilla de OTRO, un
// alumno NO lee la de otro, nadie escribe personas desde el cliente.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs';

const HOST = 'host-1', ANA = 'ana', BETO = 'beto', RUN = 'AVT001';
const testEnv = await initializeTestEnvironment({
  projectId: 'avatares-rules-test',
  firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'professors', HOST), { status: 'approved' });
  await setDoc(doc(db, 'avataresRuns', RUN), { code: RUN, hostId: HOST, fase: 'planilla', participantes: {} });
  await setDoc(doc(db, 'avataresRuns', RUN, 'planillas', ANA), { uid: ANA, ref: 'r1', campos: {}, texto: '' });
});
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
let ok = 0;
const t = async (nombre, p) => { await p; ok++; console.log(`  ok  ${nombre}`); };

await t('el anfitrion lee la planilla de otro', assertSucceeds(getDoc(doc(como(HOST), 'avataresRuns', RUN, 'planillas', ANA))));
await t('un alumno no lee la planilla de otro', assertFails(getDoc(doc(como(BETO), 'avataresRuns', RUN, 'planillas', ANA))));
await t('un alumno lee la suya', assertSucceeds(getDoc(doc(como(ANA), 'avataresRuns', RUN, 'planillas', ANA))));
await t('un alumno escribe su planilla dos veces', (async () => {
  await assertSucceeds(setDoc(doc(como(BETO), 'avataresRuns', RUN, 'planillas', BETO), { uid: BETO, ref: 'r2', campos: { a: '1' }, texto: '' }));
  await assertSucceeds(setDoc(doc(como(BETO), 'avataresRuns', RUN, 'planillas', BETO), { uid: BETO, ref: 'r2', campos: { a: '2' }, texto: '' }));
})());
await t('un alumno no escribe la planilla de otro', assertFails(setDoc(doc(como(BETO), 'avataresRuns', RUN, 'planillas', ANA), { uid: BETO })));
await t('un alumno escribe sus votos con merge', assertSucceeds(setDoc(doc(como(ANA), 'avataresRuns', RUN, 'humanos', ANA), { uid: ANA, ref: 'r1', votos: { p1: 4 } }, { merge: true })));
await t('nadie escribe personas desde el cliente', assertFails(setDoc(doc(como(HOST), 'avataresRuns', RUN, 'personas', 'a_m_r1'), { votos: {} })));
await t('un alumno no lee personas', assertFails(getDoc(doc(como(ANA), 'avataresRuns', RUN, 'personas', 'a_m_r1'))));
await t('un alumno no cambia la fase', assertFails(updateDoc(doc(como(ANA), 'avataresRuns', RUN), { fase: 'resultados' })));
await t('un alumno actualiza participantes', assertSucceeds(updateDoc(doc(como(ANA), 'avataresRuns', RUN), { [`participantes.${ANA}.planilla`]: true })));
await t('el anfitrion cambia la fase', assertSucceeds(updateDoc(doc(como(HOST), 'avataresRuns', RUN), { fase: 'encuesta' })));
await t('un profesor aprobado crea una sala propia', assertSucceeds(setDoc(doc(como(HOST), 'avataresRuns', 'AVT002'), { code: 'AVT002', hostId: HOST, participantes: {} })));
await t('un alumno no crea salas', assertFails(setDoc(doc(como(ANA), 'avataresRuns', 'AVT003'), { code: 'AVT003', hostId: ANA })));

await testEnv.cleanup();
console.log(`${ok} pruebas de avatares en verde`);
```

- [ ] **Step 7: Encadenar las pruebas en `package.json`**

Cambiar el script `test:rules` a:

```json
"test:rules": "firebase emulators:exec --only firestore \"node scripts/test-compas-rules.mjs && node scripts/test-colaboradores-rules.mjs && node scripts/test-avatares-rules.mjs\""
```

- [ ] **Step 8: Correr las reglas**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && source ~/.nvm/nvm.sh && nvm use 20.19.5 && npm run test:rules"`
Expected: las pruebas del compás y colaboradores siguen en verde y aparece `13 pruebas de avatares en verde`.

- [ ] **Step 9: Commit**

```bash
git add firestore.rules scripts/test-avatares-rules.mjs package.json src/lib/avatares/sala.ts src/lib/avatares/sala.test.ts
git commit -m "feat(avatares): sala en Firestore, reglas con pruebas y conversion a matriz

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Pantallas de recolección (M1)

**Files:**
- Create: `src/hooks/useAvataresRun.ts`
- Create: `src/pages/avatares/CrearAvatares.tsx`, `src/pages/avatares/AvataresJugar.tsx`, `src/pages/avatares/AvataresSala.tsx`
- Modify: `src/lib/joinUrl.ts` (agregar `buildAvataresUrl`, `currentAvataresUrl`)
- Modify: `src/lib/joinUrl.test.ts`
- Modify: `src/App.tsx` (rutas)

**Interfaces:**
- Consumes: `AvataresRun`, `DocPlanilla`, `DocHumano`, `DocPersona`, `crearSala`, `inscribirse`, `guardarPlanilla`, `guardarVoto`, `cambiarFase`, `aMatriz` (Task 7); `INSTRUMENTOS` (Task 2); `useAuth` (existente)
- Produces:
  - `buildAvataresUrl(code, origin, baseUrl): string` → `${origin}${base}avatares/${CODE}`
  - `useAvataresRun(code?: string): { run: AvataresRun | null; loading: boolean; error: string | null; isHost: boolean; planillas: DocPlanilla[]; humanos: DocHumano[]; personas: DocPersona[] }` (planillas/humanos/personas solo se suscriben si `isHost`)
  - Rutas: `/professor/avatares/nuevo`, `/avatares/:code`, `/avatares/:code/sala`

- [ ] **Step 1: Test de la URL (falla)**

Agregar a `src/lib/joinUrl.test.ts`:

```ts
import { buildAvataresUrl } from './joinUrl';

describe('buildAvataresUrl', () => {
  it('arma la URL absoluta con prefijo y codigo limpio', () => {
    expect(buildAvataresUrl('ab-c123', 'https://naimbro.github.io', '/ml2-master-game/'))
      .toBe('https://naimbro.github.io/ml2-master-game/avatares/ABC123');
  });
});
```

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/joinUrl.test.ts"` → FAIL.

- [ ] **Step 2: Implementar en `src/lib/joinUrl.ts`**, junto a `buildCompasUrl`:

```ts
/** URL absoluta para entrar a una sala de avatares (Semana 14 AyD). */
export function buildAvataresUrl(code: string, origin: string, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const limpio = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${origin.replace(/\/$/, '')}${base}avatares/${limpio}`;
}

export function currentAvataresUrl(code: string): string {
  return buildAvataresUrl(code, window.location.origin, import.meta.env.BASE_URL || '/');
}
```

Run el test → PASS.

- [ ] **Step 3: Hook de la sala**

```ts
// src/hooks/useAvataresRun.ts
import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { AvataresRun, DocHumano, DocPersona, DocPlanilla } from '../lib/avatares/sala';

export function useAvataresRun(code?: string) {
  const { user } = useAuth();
  const [run, setRun] = useState<AvataresRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planillas, setPlanillas] = useState<DocPlanilla[]>([]);
  const [humanos, setHumanos] = useState<DocHumano[]>([]);
  const [personas, setPersonas] = useState<DocPersona[]>([]);
  const isHost = !!run && !!user && run.hostId === user.uid;

  useEffect(() => {
    if (!code) return;
    return onSnapshot(doc(db, 'avataresRuns', code.toUpperCase()), (s) => {
      setRun(s.exists() ? (s.data() as AvataresRun) : null);
      if (!s.exists()) setError('Sala no encontrada');
      setLoading(false);
    }, (e) => { setError(e.message); setLoading(false); });
  }, [code]);

  useEffect(() => {
    if (!code || !isHost) return;
    const c = code.toUpperCase();
    const u1 = onSnapshot(collection(db, 'avataresRuns', c, 'planillas'), (s) => setPlanillas(s.docs.map((d) => d.data() as DocPlanilla)));
    const u2 = onSnapshot(collection(db, 'avataresRuns', c, 'humanos'), (s) => setHumanos(s.docs.map((d) => d.data() as DocHumano)));
    const u3 = onSnapshot(collection(db, 'avataresRuns', c, 'personas'), (s) => setPersonas(s.docs.map((d) => d.data() as DocPersona)));
    return () => { u1(); u2(); u3(); };
  }, [code, isHost]);

  return { run, loading, error, isHost, planillas, humanos, personas };
}
```

- [ ] **Step 4: Pantalla del profesor**

```tsx
// src/pages/avatares/CrearAvatares.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { INSTRUMENTOS } from '../../lib/avatares/instrumentos';
import { crearSala, type ModeloAvatar } from '../../lib/avatares/sala';

const MODELOS: (ModeloAvatar & { etiqueta: string })[] = [
  { provider: 'openai', model: 'gpt-5', etiqueta: 'OpenAI · gpt-5' },
  { provider: 'anthropic', model: 'claude-sonnet-5', etiqueta: 'Anthropic · claude-sonnet-5' },
  { provider: 'gemini', model: 'gemini-2.5-pro', etiqueta: 'Google · gemini-2.5-pro' },
];

export default function CrearAvatares() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [instrumentoId, setInstrumentoId] = useState(Object.keys(INSTRUMENTOS)[0]);
  const [elegidos, setElegidos] = useState<string[]>(MODELOS.map((m) => m.model));
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  async function crear() {
    if (!user) return;
    setCreando(true);
    try {
      const code = await crearSala(user.uid, instrumentoId, MODELOS.filter((m) => elegidos.includes(m.model)).map(({ provider, model }) => ({ provider, model })));
      navigate(`/avatares/${code}/sala`);
    } catch (e) { setError((e as Error).message); setCreando(false); }
  }

  return (
    <main className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Nueva sala de avatares</h1>
      <label className="block space-y-1">
        <span className="font-medium">Instrumento</span>
        <select className="w-full rounded border p-2" value={instrumentoId} onChange={(e) => setInstrumentoId(e.target.value)}>
          {Object.values(INSTRUMENTOS).map((p) => <option key={p.instrumentoId} value={p.instrumentoId}>{p.nombre}</option>)}
        </select>
      </label>
      <fieldset className="space-y-2">
        <legend className="font-medium">Modelos que hacen de avatar</legend>
        {MODELOS.map((m) => (
          <label key={m.model} className="flex items-center gap-2">
            <input type="checkbox" checked={elegidos.includes(m.model)}
              onChange={(e) => setElegidos(e.target.checked ? [...elegidos, m.model] : elegidos.filter((x) => x !== m.model))} />
            {m.etiqueta}
          </label>
        ))}
      </fieldset>
      {error && <p className="text-red-600">{error}</p>}
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={creando || !elegidos.length} onClick={crear}>
        Crear sala
      </button>
    </main>
  );
}
```

- [ ] **Step 5: Pantalla del alumno**

```tsx
// src/pages/avatares/AvataresJugar.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useAvataresRun } from '../../hooks/useAvataresRun';
import { guardarPlanilla, guardarVoto, inscribirse } from '../../lib/avatares/sala';
import type { Planilla } from '../../lib/avatares/planilla';

export default function AvataresJugar() {
  const { code = '' } = useParams<{ code: string }>();
  const { user } = useAuth();
  const { run, loading, error } = useAvataresRun(code);
  const [campos, setCampos] = useState<Planilla>({});
  const [enviada, setEnviada] = useState(false);
  const [votos, setVotos] = useState<Record<string, number>>({});

  useEffect(() => { if (run && user) inscribirse(run.code, user.uid).catch(() => {}); }, [run?.code, user?.uid]);
  useEffect(() => { if (run && user && run.participantes?.[user.uid]?.planilla) setEnviada(true); }, [run, user]);

  if (loading) return <p className="p-6">Cargando…</p>;
  if (error || !run || !user) return <p className="p-6">{error ?? 'Sala no encontrada'}</p>;
  const inst = run.instrumento;

  if (run.fase === 'lobby') return <p className="p-6 text-lg">Listo. Espera a que empiece la actividad.</p>;

  if (run.fase === 'planilla') {
    if (enviada) return <p className="p-6 text-lg">Planilla enviada. Tu avatar se está armando. Espera la encuesta.</p>;
    return (
      <main className="mx-auto max-w-xl space-y-4 p-4">
        <h1 className="text-xl font-bold">Tu planilla</h1>
        {inst.planilla.map((c) => (
          <label key={c.id} className="block space-y-1">
            <span className="font-medium">{c.etiqueta}</span>
            {c.ayuda && <span className="block text-sm text-gray-500">{c.ayuda}</span>}
            {c.tipo === 'opcion' ? (
              <select className="w-full rounded border p-2" value={campos[c.id] ?? ''} onChange={(e) => setCampos({ ...campos, [c.id]: e.target.value })}>
                <option value="">—</option>
                {c.opciones!.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : c.tipo === 'escala' ? (
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setCampos({ ...campos, [c.id]: String(n) })}
                    className={`h-10 w-10 rounded border ${campos[c.id] === String(n) ? 'bg-black text-white' : ''}`}>{n}</button>
                ))}
              </div>
            ) : (
              <input className="w-full rounded border p-2" value={campos[c.id] ?? ''} onChange={(e) => setCampos({ ...campos, [c.id]: e.target.value })} />
            )}
          </label>
        ))}
        <button className="w-full rounded bg-black py-3 text-white"
          onClick={async () => { await guardarPlanilla(run.code, user.uid, campos); setEnviada(true); }}>
          Enviar planilla
        </button>
      </main>
    );
  }

  if (run.fase === 'encuesta') {
    const hechas = Object.keys(votos).length;
    return (
      <main className="mx-auto max-w-xl space-y-6 p-4">
        <h1 className="text-xl font-bold">Ahora tú ({hechas}/{inst.propuestas.length})</h1>
        {inst.propuestas.map((p) => (
          <section key={p.id} className="space-y-2">
            <p className="font-medium">{p.texto}</p>
            <div className="grid grid-cols-5 gap-1">
              {inst.escala.etiquetas.map((et, i) => (
                <button key={et} title={et}
                  onClick={async () => {
                    const nuevos = { ...votos, [p.id]: i + 1 };
                    setVotos(nuevos);
                    await guardarVoto(run.code, user.uid, p.id, i + 1, Object.keys(nuevos).length);
                  }}
                  className={`rounded border py-2 text-xs ${votos[p.id] === i + 1 ? 'bg-black text-white' : ''}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </section>
        ))}
        <p className="text-sm text-gray-500">1 = {inst.escala.etiquetas[0]} · 5 = {inst.escala.etiquetas[4]}</p>
      </main>
    );
  }

  return <p className="p-6 text-lg">Mira el proyector.</p>;
}
```

- [ ] **Step 6: Pantalla de la sala (sin resultados todavía; Task 11 los agrega)**

```tsx
// src/pages/avatares/AvataresSala.tsx
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAvataresRun } from '../../hooks/useAvataresRun';
import { cambiarFase, type Fase } from '../../lib/avatares/sala';
import { currentAvataresUrl } from '../../lib/joinUrl';

const FASES: Fase[] = ['lobby', 'planilla', 'encuesta', 'resultados'];
const NOMBRE: Record<Fase, string> = { lobby: 'Entrada', planilla: 'Planilla', encuesta: 'Encuesta', resultados: 'Resultados' };

export default function AvataresSala() {
  const { code = '' } = useParams<{ code: string }>();
  const { run, loading, error, isHost, planillas, humanos, personas } = useAvataresRun(code);
  if (loading) return <p className="p-6">Cargando…</p>;
  if (error || !run) return <p className="p-6">{error ?? 'Sala no encontrada'}</p>;
  if (!isHost) return <p className="p-6">Esta pantalla es del anfitrión.</p>;
  const url = currentAvataresUrl(run.code);
  const inscritos = Object.keys(run.participantes ?? {}).length;
  const conPlanilla = Object.values(run.participantes ?? {}).filter((p) => p.planilla).length;
  const completos = humanos.filter((h) => Object.keys(h.votos ?? {}).length === run.instrumento.propuestas.length).length;
  const i = FASES.indexOf(run.fase);

  async function generarAvatares() {
    await httpsCallable(functions, 'votarComoAvatares', { timeout: 540_000 })({ code: run!.code });
  }

  return (
    <main className="min-h-screen space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <QRCodeSVG value={url} size={run.fase === 'lobby' ? 320 : 120} level="M" marginSize={0} />
          <div>
            <p className="font-mono text-3xl">{run.code}</p>
            <p className="text-sm">{url}</p>
          </div>
        </div>
        <nav className="flex gap-2">
          {i > 0 && <button className="rounded border px-3 py-2" onClick={() => cambiarFase(run.code, FASES[i - 1])}>← {NOMBRE[FASES[i - 1]]}</button>}
          {i < FASES.length - 1 && <button className="rounded bg-black px-3 py-2 text-white" onClick={() => cambiarFase(run.code, FASES[i + 1])}>{NOMBRE[FASES[i + 1]]} →</button>}
        </nav>
      </header>
      <section className="grid grid-cols-4 gap-4 text-center">
        <div><p className="text-4xl font-bold">{inscritos}</p><p>en la sala</p></div>
        <div><p className="text-4xl font-bold">{conPlanilla}</p><p>planillas</p></div>
        <div><p className="text-4xl font-bold">{completos}</p><p>encuestas completas</p></div>
        <div><p className="text-4xl font-bold">{personas.filter((p) => p.fuente === 'avatar').length}</p><p>avatares</p></div>
      </section>
      <section className="flex items-center gap-4">
        <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={!planillas.length || run.avatares?.estado === 'corriendo'} onClick={generarAvatares}>
          Generar avatares ({planillas.length} planillas × {run.modelos.length} modelos)
        </button>
        {run.avatares && <span>Avatares: {run.avatares.estado} · {run.avatares.n} listos · {run.avatares.fallos.length} fallos</span>}
      </section>
      {run.fase === 'resultados' && <p data-testid="resultados-pendientes">Resultados: ver Task 11.</p>}
    </main>
  );
}
```

- [ ] **Step 7: Rutas en `src/App.tsx`**, junto a las del compás:

```tsx
import CrearAvatares from './pages/avatares/CrearAvatares';
import AvataresJugar from './pages/avatares/AvataresJugar';
import AvataresSala from './pages/avatares/AvataresSala';
// ...
      {/* Avatares (Semana 14 AyD): el alumno entra por /avatares/:code, el anfitrion proyecta /avatares/:code/sala */}
      <Route path="/avatares/:code" element={<ConSesion><AvataresJugar /></ConSesion>} />
      <Route path="/avatares/:code/sala" element={<ConSesion><AvataresSala /></ConSesion>} />
      <Route path="/professor/avatares/nuevo" element={user ? <CrearAvatares /> : <Navigate to="/" replace />} />
```

- [ ] **Step 8: Tipos, lint y tests**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && source ~/.nvm/nvm.sh && nvm use 20.19.5 && npx tsc -b && npx eslint src/pages/avatares src/hooks/useAvataresRun.ts src/lib/avatares && npx vitest run"`
Expected: sin errores; todos los tests en verde.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useAvataresRun.ts src/pages/avatares src/lib/joinUrl.ts src/lib/joinUrl.test.ts src/App.tsx
git commit -m "feat(avatares): pantallas de creacion, alumno y sala con fases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Avatares en Functions (M2)

**Files:**
- Create: `functions/src/lib/avatares.ts`
- Test: `functions/src/lib/avatares.test.ts`
- Modify: `functions/src/index.ts` (exportar `votarComoAvatares` al final del archivo)

**Interfaces:**
- Consumes: `callJudgeModel`, `JudgeModelClients`, `JudgeProvider` (`functions/src/lib/judgeModels.ts`); `getOpenAI`, `getAnthropic`, `getGemini`, `db` (`functions/src/index.ts`); docs de la Task 7 (`planillas/{uid}` con `texto` y `ref`; run con `instrumento` y `modelos`)
- Produces:
  - `PROMPT_VERSION = 'avatar-v1'`
  - `promptAvatar(textoPlanilla: string, propuestas: { id: string; texto: string }[], etiquetas: string[]): { systemPrefix: string; systemSuffix: string; userPrompt: string }`
  - `normalizarVotos(raw: Record<string, unknown>, ids: string[]): { votos: Record<string, number>; faltantes: string[] }`
  - `idAvatarFn(modelo: string, ref: string): string` (igual a `idAvatar` de la Task 1)
  - Callable `votarComoAvatares({ code }) → { n: number; fallos: string[] }`; escribe `avataresRuns/{code}/personas/{idAvatarFn(model, ref)}` y `avatares` en el run

- [ ] **Step 1: Write the failing test**

```ts
// functions/src/lib/avatares.test.ts
import { describe, expect, it } from 'vitest';
import { idAvatarFn, normalizarVotos, promptAvatar, PROMPT_VERSION } from './avatares';

describe('normalizarVotos', () => {
  const ids = ['p1', 'p2', 'p3', 'p4'];
  it('acepta enteros y strings numericos, redondea, descarta fuera de rango e ids ajenos', () => {
    const r = normalizarVotos({ p1: 5, p2: '4', p3: 7, x: 3, p4: 2.6 }, ids);
    expect(r.votos).toEqual({ p1: 5, p2: 4, p4: 3 });
    expect(r.faltantes).toEqual(['p3']);
  });
  it('acepta la forma anidada {votos: {...}}', () => {
    expect(normalizarVotos({ votos: { p1: 1, p2: 2, p3: 3, p4: 4 } }, ids).faltantes).toEqual([]);
  });
  it('todo faltante si la respuesta no sirve', () => {
    expect(normalizarVotos({}, ids).faltantes).toEqual(ids);
  });
});

describe('promptAvatar', () => {
  const p = promptAvatar('Edad (tramo): 21-25\nEn economía me considero: centro', [{ id: 'p1', texto: 'Subir el salario' }], ['A', 'B', 'C', 'D', 'E']);
  it('lleva la planilla, las propuestas con su id y pide JSON', () => {
    expect(p.systemSuffix).toContain('21-25');
    expect(p.systemSuffix).toContain('"p1"');
    expect(p.systemSuffix).toContain('Subir el salario');
    expect(p.userPrompt).toMatch(/JSON/);
  });
  it('el prefijo es identico para todos los alumnos (cache)', () => {
    const q = promptAvatar('otra cosa', [{ id: 'p1', texto: 'Subir el salario' }], ['A', 'B', 'C', 'D', 'E']);
    expect(q.systemPrefix).toBe(p.systemPrefix);
  });
  it('version y ids', () => {
    expect(PROMPT_VERSION).toBe('avatar-v1');
    expect(idAvatarFn('org/x 1', 'r1')).toBe('a_org-x-1_r1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares/functions && npx vitest run src/lib/avatares.test.ts"`
Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Implementar lo puro**

```ts
// functions/src/lib/avatares.ts
// Avatares de la Semana 14 AyD (spec 2026-11-07, M2). El texto de la planilla ya
// viene seudonimizado desde la app (planillaComoTexto): sin nombre, uid, correo
// ni ciudad, edad en tramos. El parrafo de instrucciones es el de la planilla de
// Vina, para que el avatar sea el mismo que armaban los alumnos a mano.
export const PROMPT_VERSION = 'avatar-v1';

export function idAvatarFn(modelo: string, ref: string): string {
  return `a_${modelo.replace(/[/\s]+/g, '-')}_${ref}`;
}

export function promptAvatar(textoPlanilla: string, propuestas: { id: string; texto: string }[], etiquetas: string[]) {
  const systemPrefix =
    'Por favor, a partir de la información que está abajo, simula ser mi representante político digital (mi avatar). ' +
    'Responde siempre como si fueras yo, tomando decisiones políticas coherentes con estas preferencias. ' +
    'No hables como un asistente de IA, sino como si fueras mi representante político.\n\n' +
    `Escala: 1 = ${etiquetas[0]}, 2 = ${etiquetas[1]}, 3 = ${etiquetas[2]}, 4 = ${etiquetas[3]}, 5 = ${etiquetas[4]}.\n`;
  const lista = propuestas.map((p) => `- "${p.id}": ${p.texto}`).join('\n');
  const systemSuffix = `\nMi información:\n${textoPlanilla}\n\nPropuestas:\n${lista}\n`;
  const userPrompt =
    'Vota cada propuesta como votaría yo. Responde SOLO con un objeto JSON cuyas claves son los ids de las propuestas ' +
    'y cuyos valores son enteros de 1 a 5. Sin texto adicional.';
  return { systemPrefix, systemSuffix, userPrompt };
}

export function normalizarVotos(raw: Record<string, unknown>, ids: string[]) {
  const fuente = (raw && typeof raw.votos === 'object' && raw.votos !== null ? raw.votos : raw) as Record<string, unknown>;
  const votos: Record<string, number> = {};
  const faltantes: string[] = [];
  for (const id of ids) {
    const v = Number(typeof fuente[id] === 'string' ? (fuente[id] as string).trim() : fuente[id]);
    const r = Math.round(v);
    if (Number.isFinite(v) && r >= 1 && r <= 5) votos[id] = r;
    else faltantes.push(id);
  }
  return { votos, faltantes };
}
```

- [ ] **Step 4: Run test to verify it passes** — same command. Expected: PASS.

- [ ] **Step 5: El callable**, al final de `functions/src/index.ts` (agregar `import { idAvatarFn, normalizarVotos, promptAvatar, PROMPT_VERSION } from './lib/avatares';` junto a los demás imports de `./lib/...`):

```ts
/**
 * Avatares de la Semana 14 AyD (spec 2026-11-07, M2). Solo el anfitrion.
 * Una llamada por planilla y por modelo, con todas las propuestas. Ids
 * deterministas: correrlo dos veces sobrescribe, no duplica. Un fallo marca a la
 * persona con sus faltantes y no tumba la corrida.
 */
export const votarComoAvatares = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 540, memory: '512MB', secrets: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    const code = String(data?.code ?? '').toUpperCase();
    const runRef = db.collection('avataresRuns').doc(code);
    const run = (await runRef.get()).data();
    if (!run) throw new functions.https.HttpsError('not-found', 'Sala no encontrada');
    if (run.hostId !== context.auth.uid) throw new functions.https.HttpsError('permission-denied', 'Solo el anfitrion');

    const propuestas = (run.instrumento.propuestas as { id: string; texto: string }[]).map(({ id, texto }) => ({ id, texto }));
    const ids = propuestas.map((p) => p.id);
    const etiquetas = run.instrumento.escala.etiquetas as string[];
    const modelos = run.modelos as { provider: JudgeProvider; model: string }[];
    const planillas = (await runRef.collection('planillas').get()).docs.map((d) => d.data() as { ref: string; texto: string });
    await runRef.update({ avatares: { estado: 'corriendo', n: 0, fallos: [] } });

    const clients: JudgeModelClients = {};
    if (modelos.some((m) => m.provider === 'openai')) clients.openai = await getOpenAI();
    if (modelos.some((m) => m.provider === 'anthropic')) clients.anthropic = await getAnthropic();
    if (modelos.some((m) => m.provider === 'gemini')) clients.gemini = await getGemini();

    const tareas = planillas.flatMap((p) => modelos.map((m) => ({ p, m })));
    const fallos: string[] = [];
    let n = 0;
    const TOPE = 8;
    for (let i = 0; i < tareas.length; i += TOPE) {
      await Promise.all(tareas.slice(i, i + TOPE).map(async ({ p, m }) => {
        const prompt = promptAvatar(p.texto, propuestas, etiquetas);
        let res = { votos: {} as Record<string, number>, faltantes: ids };
        for (let intento = 0; intento < 2 && res.faltantes.length; intento++) {
          try {
            const raw = await callJudgeModel(clients, { provider: m.provider, model: m.model, ...prompt, maxTokens: 800 });
            const nuevo = normalizarVotos(raw, ids);
            res = { votos: { ...res.votos, ...nuevo.votos }, faltantes: ids.filter((id) => !(id in { ...res.votos, ...nuevo.votos })) };
          } catch (e) {
            functions.logger.warn('avatar fallo', { model: m.model, ref: p.ref, error: (e as Error).message });
          }
        }
        const id = idAvatarFn(m.model, p.ref);
        await runRef.collection('personas').doc(id).set({
          id, ref: p.ref, fuente: 'avatar', via: 'app', modelo: m.model, condicion: PROMPT_VERSION,
          votos: res.votos, faltantes: res.faltantes,
        });
        if (res.faltantes.length === ids.length) fallos.push(id); else n += 1;
      }));
    }
    await runRef.update({ avatares: { estado: fallos.length === tareas.length ? 'error' : 'listo', n, fallos } });
    return { n, fallos };
  });
```

Verificar que `JudgeProvider` y `JudgeModelClients` ya estén importados en `index.ts` desde `./lib/judgeModels` (lo están para `evaluateSubmission`; si no, agregarlos al import existente). Si `JudgeModelClients` no tiene campo `gemini`, revisar su definición en `functions/src/lib/judgeModels.ts:142` y usar el nombre que tenga.

- [ ] **Step 6: Compilar y testear Functions**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares/functions && npm run build && npx vitest run"`
Expected: compila; tests en verde.

- [ ] **Step 7: Commit**

```bash
git add functions/src/lib/avatares.ts functions/src/lib/avatares.test.ts functions/src/index.ts
git commit -m "feat(avatares): callable votarComoAvatares con normalizacion y reintento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Gráficos de resultados (M4 componentes)

**Files:**
- Create: `src/components/avatares/MapaComun.tsx`, `src/components/avatares/TablaPuente.tsx`, `src/components/avatares/BarrasCorrelacion.tsx`
- Create: `src/lib/avatares/vista.ts` (cálculo de todo lo que muestra la sala, puro)
- Test: `src/lib/avatares/vista.test.ts`

**Interfaces:**
- Consumes: Tasks 3–6
- Produces:
  - `interface Vista { mapa: Mapa; cn: ResultadoCN; porCamara: Record<string, { etiqueta: string; rankings: Rankings; aprobacion: ReturnType<typeof aprobacion>; dispersionMedia: number }>; correlaciones: Record<string, ReturnType<typeof correlacionPorPropuesta>>; textos: Record<string, string> }`
  - `calcularVista(m: Matriz): Vista` — cámaras: `humano`, cada `avatar` por modelo (`avatar:<modelo>`), `avatar_red` (todas las réplicas); correlaciones de cada cámara contra `humano`
  - `<MapaComun mapa cn propuestas grupos />`, `<TablaPuente vista camara />`, `<BarrasCorrelacion correlacion textos />`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/avatares/vista.test.ts
import { describe, expect, it } from 'vitest';
import { instrumentoDe } from './instrumentos';
import { sintetizar } from './sinteticos';
import { calcularVista } from './vista';

describe('calcularVista', () => {
  const { matriz } = sintetizar(instrumentoDe('ayd14_vina_v1')!, { semilla: 5, n: 25, replicas: 2 });
  const v = calcularVista(matriz);
  it('arma las camaras presentes', () => {
    expect(Object.keys(v.porCamara).sort()).toEqual(['avatar:sintetico', 'avatar_red', 'humano']);
  });
  it('correlaciona cada camara contra humanos', () => {
    expect(v.correlaciones['avatar:sintetico'].promedio).not.toBeNull();
    expect(v.correlaciones.humano).toBeUndefined();
  });
  it('sin avatares todavia: solo la camara humana, sin romperse', () => {
    const solo = { ...matriz, personas: matriz.personas.filter((p) => p.fuente === 'humano') };
    const ids = new Set(solo.personas.map((p) => p.id));
    const w = calcularVista({ ...solo, votos: matriz.votos.filter((x) => ids.has(x.persona)) });
    expect(Object.keys(w.porCamara)).toEqual(['humano']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/vista.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar `vista.ts`**

```ts
// src/lib/avatares/vista.ts
import type { Matriz, Persona } from './contrato';
import { aprobacion, correlacionPorPropuesta, dispersion, porFuente, type FiltroPersona } from './analitica/basico';
import { mapaPCA, type Mapa } from './analitica/mapa';
import { factorizacionCN, rankings, type ResultadoCN, type Rankings } from './analitica/puentes';

export interface Vista {
  mapa: Mapa;
  cn: ResultadoCN;
  porCamara: Record<string, { etiqueta: string; rankings: Rankings; aprobacion: ReturnType<typeof aprobacion>; dispersionMedia: number }>;
  correlaciones: Record<string, ReturnType<typeof correlacionPorPropuesta>>;
  textos: Record<string, string>;
}

function camaras(m: Matriz): Record<string, { etiqueta: string; filtro: FiltroPersona }> {
  const out: Record<string, { etiqueta: string; filtro: FiltroPersona }> = {};
  if (m.personas.some((p) => p.fuente === 'humano')) out.humano = { etiqueta: 'La sala', filtro: porFuente('humano') };
  const modelos = [...new Set(m.personas.filter((p) => p.fuente === 'avatar').map((p) => p.modelo ?? '?'))].sort();
  for (const mod of modelos) out[`avatar:${mod}`] = { etiqueta: `Avatares · ${mod}`, filtro: (p: Persona) => p.fuente === 'avatar' && (p.modelo ?? '?') === mod };
  if (m.personas.some((p) => p.fuente === 'avatar_red')) out.avatar_red = { etiqueta: 'Avatares después de deliberar', filtro: porFuente('avatar_red') };
  return out;
}

export function calcularVista(m: Matriz): Vista {
  const cs = camaras(m);
  const porCamara: Vista['porCamara'] = {};
  const correlaciones: Vista['correlaciones'] = {};
  for (const [k, { etiqueta, filtro }] of Object.entries(cs)) {
    const d = Object.values(dispersion(m, filtro)).filter(Number.isFinite);
    porCamara[k] = { etiqueta, rankings: rankings(m, filtro), aprobacion: aprobacion(m, filtro), dispersionMedia: d.length ? d.reduce((a, b) => a + b, 0) / d.length : NaN };
    if (k !== 'humano' && cs.humano) correlaciones[k] = correlacionPorPropuesta(m, cs.humano.filtro, filtro);
  }
  return {
    mapa: mapaPCA(m),
    cn: factorizacionCN(m, cs.humano?.filtro ?? (() => true)),
    porCamara,
    correlaciones,
    textos: Object.fromEntries(m.instrumento.propuestas.map((p) => [p.id, p.tema ?? p.texto])),
  };
}
```

- [ ] **Step 4: Run test to verify it passes** — same command. Expected: PASS.

- [ ] **Step 5: Componentes SVG** (hand-rolled, como `CompasPlano.tsx`; sin librerías nuevas)

```tsx
// src/components/avatares/MapaComun.tsx
import type { Mapa } from '../../lib/avatares/analitica/mapa';
import type { ResultadoCN } from '../../lib/avatares/analitica/puentes';
import type { Fuente } from '../../lib/avatares/contrato';

const COLOR: Record<Fuente, string> = { humano: '#111827', avatar: '#2563eb', avatar_red: '#dc2626', bot: '#9ca3af' };
const NOMBRE: Record<Fuente, string> = { humano: 'Humanos', avatar: 'Avatares solos', avatar_red: 'Avatares en red', bot: 'Bots' };

/** Un solo plano: personas (puntos) y propuestas (rombos, ubicadas por sus cargas). Sin nombres. */
export default function MapaComun({ mapa, cn, textos, fuentes }: { mapa: Mapa; cn: ResultadoCN; textos: Record<string, string>; fuentes: Fuente[] }) {
  const W = 900, H = 560, pad = 40;
  const xs = mapa.puntos.map((p) => p.x), ys = mapa.puntos.map((p) => p.y);
  const ext = Math.max(1e-6, ...xs.map(Math.abs), ...ys.map(Math.abs));
  const sx = (x: number) => W / 2 + (x / ext) * (W / 2 - pad);
  const sy = (y: number) => H / 2 - (y / ext) * (H / 2 - pad);
  const escalaCarga = ext * 0.9;
  return (
    <figure className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border bg-white">
        <line x1={pad} x2={W - pad} y1={H / 2} y2={H / 2} stroke="#e5e7eb" />
        <line y1={pad} y2={H - pad} x1={W / 2} x2={W / 2} stroke="#e5e7eb" />
        {mapa.puntos.filter((p) => fuentes.includes(p.fuente)).map((p) => (
          <circle key={p.personaId} cx={sx(p.x)} cy={sy(p.y)} r={p.fuente === 'humano' ? 7 : 5} fill={COLOR[p.fuente]} fillOpacity={0.7} />
        ))}
        {mapa.cargas.map((c) => {
          const x = sx(c.x * escalaCarga), y = sy(c.y * escalaCarga);
          const puente = cn.propuestas[c.propuesta]?.intercepto ?? 0;
          return (
            <g key={c.propuesta}>
              <rect x={x - 6} y={y - 6} width={12} height={12} transform={`rotate(45 ${x} ${y})`} fill="#f59e0b" fillOpacity={0.4 + Math.min(0.6, Math.max(0, puente))} />
              <text x={x + 10} y={y + 4} fontSize={13} fill="#374151">{textos[c.propuesta]}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex gap-4 text-sm">
        {fuentes.map((f) => <span key={f}><span style={{ color: COLOR[f] }}>●</span> {NOMBRE[f]}</span>)}
        <span><span className="text-amber-500">◆</span> Propuestas (más opaca = más puente)</span>
        {mapa.degenerado && <span className="text-red-600">Pocos datos: el mapa es orientativo.</span>}
      </figcaption>
    </figure>
  );
}
```

```tsx
// src/components/avatares/TablaPuente.tsx
import type { Vista } from '../../lib/avatares/vista';

export default function TablaPuente({ vista, camara }: { vista: Vista; camara: string }) {
  const c = vista.porCamara[camara];
  if (!c) return null;
  const filas = Math.max(c.rankings.mayoria.length, c.rankings.puenteCN.length);
  return (
    <table className="w-full text-left">
      <caption className="pb-2 text-left font-bold">{c.etiqueta} · {c.rankings.grupos.k} grupos detectados</caption>
      <thead><tr><th>#</th><th>Por mayoría</th><th>Por puente (Community Notes)</th><th>Por puente (Polis)</th></tr></thead>
      <tbody>
        {Array.from({ length: filas }, (_, i) => (
          <tr key={i} className="border-t">
            <td>{i + 1}</td>
            <td>{vista.textos[c.rankings.mayoria[i]]} <small>{Math.round((c.aprobacion[c.rankings.mayoria[i]]?.tasa ?? 0) * 100)}%</small></td>
            <td>{vista.textos[c.rankings.puenteCN[i]]}</td>
            <td>{vista.textos[c.rankings.puentePolis[i]]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```tsx
// src/components/avatares/BarrasCorrelacion.tsx
import type { correlacionPorPropuesta } from '../../lib/avatares/analitica/basico';

type Corr = ReturnType<typeof correlacionPorPropuesta>;

export default function BarrasCorrelacion({ titulo, corr, textos }: { titulo: string; corr: Corr; textos: Record<string, string> }) {
  const filas = Object.entries(corr.porPropuesta).sort((a, b) => (b[1].r ?? -2) - (a[1].r ?? -2));
  return (
    <section className="space-y-1">
      <h3 className="font-bold">{titulo} · promedio {corr.promedio === null ? '—' : corr.promedio.toFixed(2).replace('.', ',')}</h3>
      {filas.map(([id, { r, n }]) => (
        <div key={id} className="flex items-center gap-2 text-sm">
          <span className="w-56 truncate">{textos[id]}</span>
          <div className="h-3 flex-1 bg-gray-100"><div className="h-3 bg-blue-600" style={{ width: `${Math.max(0, r ?? 0) * 100}%` }} /></div>
          <span className="w-16 text-right">{r === null ? '—' : r.toFixed(2).replace('.', ',')} <small>n={n}</small></span>
        </div>
      ))}
      {corr.refsSinPareja > 0 && <p className="text-xs text-gray-500">{corr.refsSinPareja} sin pareja (no respondieron las dos partes).</p>}
    </section>
  );
}
```

- [ ] **Step 6: Tipos y lint**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && source ~/.nvm/nvm.sh && nvm use 20.19.5 && npx tsc -b && npx eslint src/components/avatares src/lib/avatares"`
Expected: limpio.

- [ ] **Step 7: Commit**

```bash
git add src/lib/avatares/vista.ts src/lib/avatares/vista.test.ts src/components/avatares
git commit -m "feat(avatares): calculo de la vista y graficos del mapa comun, puentes y correlaciones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Resultados en la sala y vista previa sintética (M4 pantalla)

**Files:**
- Create: `src/components/avatares/PanelResultados.tsx`
- Create: `src/pages/avatares/AvataresPreview.tsx`
- Modify: `src/pages/avatares/AvataresSala.tsx` (reemplazar el placeholder de resultados)
- Modify: `src/App.tsx` (ruta `/preview-avatares` sin login)

**Interfaces:**
- Consumes: `calcularVista`, `Vista` (Task 10); `aMatriz` (Task 7); `inundar` (Task 5); `sintetizar` (Task 6); componentes de la Task 10
- Produces: `<PanelResultados matriz={Matriz} />` con pestañas «Avatar vs. tú», «Mapa», «Mayoría vs. puente», «Bots»

- [ ] **Step 1: Panel de resultados**

```tsx
// src/components/avatares/PanelResultados.tsx
import { useMemo, useState } from 'react';
import type { Matriz } from '../../lib/avatares/contrato';
import { inundar } from '../../lib/avatares/analitica/puentes';
import { calcularVista } from '../../lib/avatares/vista';
import BarrasCorrelacion from './BarrasCorrelacion';
import MapaComun from './MapaComun';
import TablaPuente from './TablaPuente';

type Pestana = 'correlacion' | 'mapa' | 'puente' | 'bots';

export default function PanelResultados({ matriz }: { matriz: Matriz }) {
  const [pestana, setPestana] = useState<Pestana>('correlacion');
  const [bots, setBots] = useState(0);
  const vista = useMemo(() => calcularVista(matriz), [matriz]);
  const humanos = matriz.personas.filter((p) => p.fuente === 'humano');
  // Los bots copian al humano en el extremo del primer eje (determinista).
  const copiado = useMemo(() => {
    const pts = vista.mapa.puntos.filter((p) => p.fuente === 'humano');
    return pts.reduce((b, p) => (Math.abs(p.x) > Math.abs(b?.x ?? 0) ? p : b), pts[0])?.personaId;
  }, [vista]);
  const conBots = useMemo(() => {
    if (!copiado) return null;
    const ids = new Set(humanos.map((h) => h.id));
    const soloHumanos = { ...matriz, personas: humanos, votos: matriz.votos.filter((v) => ids.has(v.persona)) };
    return calcularVista(inundar(soloHumanos, copiado, bots), true);
  }, [matriz, copiado, bots]);
  const camaras = Object.keys(vista.porCamara);

  return (
    <section className="space-y-4">
      <nav className="flex gap-2">
        {([['correlacion', 'Avatar vs. tú'], ['mapa', 'Mapa'], ['puente', 'Mayoría vs. puente'], ['bots', 'Bots']] as [Pestana, string][]).map(([k, t]) => (
          <button key={k} onClick={() => setPestana(k)} className={`rounded px-3 py-2 ${pestana === k ? 'bg-black text-white' : 'border'}`}>{t}</button>
        ))}
      </nav>
      {pestana === 'correlacion' && (
        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(vista.correlaciones).map(([k, c]) => (
            <BarrasCorrelacion key={k} titulo={vista.porCamara[k].etiqueta} corr={c} textos={vista.textos} />
          ))}
          {!Object.keys(vista.correlaciones).length && <p>Todavía no hay avatares.</p>}
        </div>
      )}
      {pestana === 'mapa' && <MapaComun mapa={vista.mapa} cn={vista.cn} textos={vista.textos} fuentes={['humano', 'avatar', 'avatar_red']} />}
      {pestana === 'puente' && <div className="grid gap-6 xl:grid-cols-2">{camaras.map((k) => <TablaPuente key={k} vista={vista} camara={k} />)}</div>}
      {pestana === 'bots' && conBots && (
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <span>Copias idénticas de una persona: {bots}</span>
            <input type="range" min={0} max={40} value={bots} onChange={(e) => setBots(Number(e.target.value))} />
          </label>
          <div className="grid gap-6 xl:grid-cols-2">
            <MapaComun mapa={conBots.mapa} cn={conBots.cn} textos={conBots.textos} fuentes={['humano', 'bot']} />
            <TablaPuente vista={conBots} camara="humano" />
          </div>
        </div>
      )}
    </section>
  );
}
```

Nota: el componente ya llama `calcularVista(..., true)`, que todavía no existe. En la pestaña «Bots» los bots tienen que contar en la sala: implementarlo agregando a `calcularVista` un segundo parámetro opcional `incluirBotsEnSala = false` que, si es `true`, define la cámara `humano` como `p.fuente === 'humano' || p.fuente === 'bot'`, y llamar `calcularVista(inundar(...), true)`. Agregar a `vista.test.ts`:

```ts
  it('con incluirBotsEnSala los bots cuentan en la sala y mueven la mayoria', () => {
    const solo = { ...matriz, personas: matriz.personas.filter((p) => p.fuente === 'humano') };
    const ids = new Set(solo.personas.map((p) => p.id));
    const base = { ...solo, votos: matriz.votos.filter((x) => ids.has(x.persona)) };
    const id = base.personas[0].id;
    const sin = calcularVista(base).porCamara.humano.aprobacion;
    const con = calcularVista(inundar(base, id, 30), true).porCamara.humano.aprobacion;
    expect(Object.keys(con).some((k) => Math.abs(con[k].tasa - sin[k].tasa) > 0.1)).toBe(true);
  });
```

(con `import { inundar } from './analitica/puentes';` arriba del archivo de test).

- [ ] **Step 2: Correr el test nuevo (falla), implementar el parámetro, correr (pasa)**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/vista.test.ts"`
Expected: primero FAIL en el test nuevo; después de cambiar en `vista.ts` la firma a `calcularVista(m: Matriz, incluirBotsEnSala = false)` y en `camaras` la línea de `humano` a `filtro: incluirBotsEnSala ? (p: Persona) => p.fuente === 'humano' || p.fuente === 'bot' : porFuente('humano')`, PASS.

- [ ] **Step 3: Conectar en la sala.** En `AvataresSala.tsx`, reemplazar la línea `{run.fase === 'resultados' && <p data-testid="resultados-pendientes">…</p>}` por:

```tsx
      {run.fase === 'resultados' && <PanelResultados matriz={aMatriz(run.instrumento, humanos, personas)} />}
```

con `import PanelResultados from '../../components/avatares/PanelResultados';` y `aMatriz` agregado al import de `../../lib/avatares/sala`.

- [ ] **Step 4: Vista previa sin login**

```tsx
// src/pages/avatares/AvataresPreview.tsx
// Hermano de /preview-compas: toda la cadena con datos sinteticos, sin login. Es
// el ensayo de Naim y el respaldo visual si algo falla en clase.
import { useMemo, useState } from 'react';
import PanelResultados from '../../components/avatares/PanelResultados';
import { instrumentoDe } from '../../lib/avatares/instrumentos';
import { sintetizar } from '../../lib/avatares/sinteticos';

export default function AvataresPreview() {
  const [semilla, setSemilla] = useState(1);
  const matriz = useMemo(() => sintetizar(instrumentoDe('ayd14_vina_v1')!, { semilla, n: 28, replicas: 3 }).matriz, [semilla]);
  return (
    <main className="space-y-4 p-6">
      <header className="flex items-center gap-4">
        <h1 className="text-xl font-bold">Vista previa · avatares (datos sintéticos)</h1>
        <button className="rounded border px-3 py-1" onClick={() => setSemilla(semilla + 1)}>Otra sala</button>
      </header>
      <PanelResultados matriz={matriz} />
    </main>
  );
}
```

En `src/App.tsx`, junto a `/preview-compas`: `<Route path="/preview-avatares" element={<AvataresPreview />} />` con su import.

- [ ] **Step 5: Verificar en el navegador**

Levantar Vite en WSL (`npx vite --host 127.0.0.1`) y abrir `http://127.0.0.1:5173/ml2-master-game/preview-avatares` con el navegador integrado. Revisar las cuatro pestañas, la consola sin errores y un ancho de proyector (1920×1080) y de teléfono (375×812). Captura de pantalla de cada pestaña.

- [ ] **Step 6: Suite completa, tipos y build**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && source ~/.nvm/nvm.sh && nvm use 20.19.5 && npx vitest run && npx tsc -b && npx eslint src && npm run build"`
Expected: todo en verde.

- [ ] **Step 7: Commit**

```bash
git add src/components/avatares/PanelResultados.tsx src/pages/avatares src/App.tsx src/lib/avatares/vista.ts src/lib/avatares/vista.test.ts
git commit -m "feat(avatares): resultados en la sala y vista previa sintetica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Puente con MiroFish, lado del juego (M5: exportar e importar)

**Files:**
- Create: `src/lib/avatares/mirofishPuente.ts`
- Test: `src/lib/avatares/mirofishPuente.test.ts`
- Create: `scripts/avatares-mirofish-export.ts`, `scripts/avatares-mirofish-import.ts`

**Interfaces:**
- Consumes: contrato (Task 1), `DocPlanilla`, `DocPersona` (Task 7), `tramoEdad` (Task 2)
- Produces:
  - `panelDesdePlanillas(planillas: DocPlanilla[], code: string): { panel: PanelMirofish; spec: SpecMirofish }`
    - `PanelMirofish = { version: string; size: number; note: string; personas: PersonaMirofish[] }`
    - `PersonaMirofish = { id /* = ref */; nombre: string; sexo: 'Mujer' | 'Hombre' | 'No informa'; edad: number; tramo_edad: string; zona: 'UAI'; comuna: 'Peñalolén'; educacion: 'Universitaria (en curso)'; ocupacion: string; posicion_politica: 'Ninguna'; mbti: 'ISTJ'; persona: string }`
    - `SpecMirofish = { SIZE: number; SEX: Record<string, number>; AGE: Record<string, number>; EDU: Record<string, number>; POL: Record<string, number>; ZONES: { UAI: [1, string[]] } }`
  - `itemsDesdeInstrumento(inst: Instrumento): { question: ItemMirofish; items: ItemMirofish[] }` con `ItemMirofish = { id; scale: 'choice'; topic; context; question; options: { letter; text }[] }`
  - `validarResultadosMirofish(json: unknown, refsValidos: Set<string>, propuestas: Set<string>): { personas: DocPersona[]; errores: string[] }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/avatares/mirofishPuente.test.ts
import { describe, expect, it } from 'vitest';
import { instrumentoDe } from './instrumentos';
import { itemsDesdeInstrumento, panelDesdePlanillas, validarResultadosMirofish } from './mirofishPuente';

const inst = instrumentoDe('ayd14_vina_v1')!;
const planillas = [
  { uid: 'u1', ref: 'r1', campos: { edad: '22', genero: 'mujer', pais_ciudad: 'Viña' }, texto: 'Edad (tramo): 21-25\nGénero (opcional): mujer' },
  { uid: 'u2', ref: 'r2', campos: { edad: '19' }, texto: 'Edad (tramo): 18-20' },
  { uid: 'u3', ref: 'r3', campos: {}, texto: '' },
];

describe('panelDesdePlanillas', () => {
  const { panel, spec } = panelDesdePlanillas(planillas, 'ABC123');
  it('una persona por planilla, id = ref, sin uid, sin ciudad, sin nombre real', () => {
    expect(panel.personas.map((p) => p.id)).toEqual(['r1', 'r2', 'r3']);
    const s = JSON.stringify(panel);
    expect(s).not.toContain('u1');
    expect(s).not.toContain('Viña');
    expect(panel.personas[0].nombre).toBe('Estudiante 1');
    expect(panel.personas[0].sexo).toBe('Mujer');
    expect(panel.personas[2].sexo).toBe('No informa');
  });
  it('la spec reproduce exactamente las marginales del panel', () => {
    expect(spec.SIZE).toBe(3);
    const suma = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    for (const k of ['SEX', 'AGE', 'EDU', 'POL'] as const) expect(suma(spec[k])).toBeCloseTo(1);
    expect(spec.AGE['21-25']).toBeCloseTo(1 / 3);
  });
  it('la persona de MiroFish es el texto seudonimizado, nunca respuestas', () => {
    expect(panel.personas[0].persona).toContain('21-25');
    expect(panel.personas[0].persona).toContain('Universidad Adolfo Ibáñez');
  });
});

describe('itemsDesdeInstrumento', () => {
  const { question, items } = itemsDesdeInstrumento(inst);
  it('eleccion forzada entre la propuesta y su polo, sin escala de acuerdo y sin digitos en el contexto', () => {
    expect(items).toHaveLength(11);
    for (const it of [question, ...items]) {
      expect(it.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D']);
      expect(it.options[2].text).toBe('Ninguna de las dos');
      expect(it.options[3].text).toBe('No sé');
      expect(it.options.some((o) => /acuerdo/i.test(o.text))).toBe(false);
      expect(it.context).not.toMatch(/[0-9%]/);
    }
  });
});

describe('validarResultadosMirofish', () => {
  const refs = new Set(['r1', 'r2']), props = new Set(['salario_minimo', 'aborto']);
  it('acepta personas del contrato con ids de MiroFish y descarta lo ajeno', () => {
    const r = validarResultadosMirofish({ personas: [
      { id: 'mb_r1', ref: 'r1', fuente: 'avatar', via: 'mirofish', modelo: 'gemini-2.5-flash-lite', votos: { salario_minimo: 5, aborto: 3 } },
      { id: 'mr1_r2', ref: 'r2', fuente: 'avatar_red', via: 'mirofish', replica: 1, votos: { salario_minimo: 1, nope: 5 } },
      { id: 'mr1_rX', ref: 'rX', fuente: 'avatar_red', via: 'mirofish', replica: 1, votos: {} },
    ] }, refs, props);
    expect(r.personas).toHaveLength(2);
    expect(r.personas[1].votos).toEqual({ salario_minimo: 1 });
    expect(r.errores.some((e) => e.includes('rX'))).toBe(true);
  });
  it('rechaza un json sin personas', () => {
    expect(validarResultadosMirofish({}, refs, props).errores.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx vitest run src/lib/avatares/mirofishPuente.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/avatares/mirofishPuente.ts
// Puente con MiroFish (spec M5). Lo que sale: el texto seudonimizado de la
// planilla como persona, nada mas. MiroFish exige campos de panel y marginales
// exactas (weekly/panel.py:validate_panel); la spec se GENERA desde el panel.
// MiroFish rechaza escalas de acuerdo/desacuerdo: cada propuesta va como
// eleccion forzada entre texto (A) y polo (B), mas Ninguna (C) y No se (D).
import type { Instrumento, Persona } from './contrato';
import type { DocPersona, DocPlanilla } from './sala';
import { tramoEdad } from './planilla';

export interface PersonaMirofish {
  id: string; nombre: string; sexo: 'Mujer' | 'Hombre' | 'No informa'; edad: number; tramo_edad: string;
  zona: 'UAI'; comuna: 'Peñalolén'; educacion: 'Universitaria (en curso)'; ocupacion: string;
  posicion_politica: 'Ninguna'; mbti: 'ISTJ'; persona: string;
}
export interface PanelMirofish { version: string; size: number; note: string; personas: PersonaMirofish[] }
export interface SpecMirofish {
  SIZE: number; SEX: Record<string, number>; AGE: Record<string, number>; EDU: Record<string, number>;
  POL: Record<string, number>; ZONES: { UAI: [number, string[]] };
}
export interface ItemMirofish {
  id: string; scale: 'choice'; topic: string; context: string; question: string; options: { letter: string; text: string }[];
}

const EDAD_CENTRAL: Record<string, number> = { '18-20': 19, '21-25': 23, '26-30': 28, '31+': 33, 'no informa': 22 };

function sexoDe(genero: string | undefined): PersonaMirofish['sexo'] {
  const g = (genero ?? '').trim().toLowerCase();
  if (/^(mujer|femenino|f)$/.test(g)) return 'Mujer';
  if (/^(hombre|masculino|m)$/.test(g)) return 'Hombre';
  return 'No informa';
}

function proporciones(xs: string[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const x of xs) c[x] = (c[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / xs.length]));
}

export function panelDesdePlanillas(planillas: DocPlanilla[], code: string) {
  const orden = [...planillas].sort((a, b) => a.ref.localeCompare(b.ref));
  const personas: PersonaMirofish[] = orden.map((p, i) => {
    const tramo = tramoEdad(p.campos.edad ?? '');
    return {
      id: p.ref, nombre: `Estudiante ${i + 1}`, sexo: sexoDe(p.campos.genero), edad: EDAD_CENTRAL[tramo], tramo_edad: tramo,
      zona: 'UAI', comuna: 'Peñalolén', educacion: 'Universitaria (en curso)',
      ocupacion: (p.campos.ocupacion ?? 'estudiante universitario').slice(0, 80), posicion_politica: 'Ninguna', mbti: 'ISTJ',
      persona: `Estudiante de la Universidad Adolfo Ibáñez, en Chile. Así se describe políticamente:\n${p.texto}`,
    };
  });
  const panel: PanelMirofish = { version: `panel_ayd14_${code}`, size: personas.length, note: 'Planillas seudonimizadas de la Semana 14 AyD (autorizado 2026-11-07).', personas };
  const spec: SpecMirofish = {
    SIZE: personas.length,
    SEX: proporciones(personas.map((p) => p.sexo)),
    AGE: proporciones(personas.map((p) => p.tramo_edad)),
    EDU: proporciones(personas.map((p) => p.educacion)),
    POL: proporciones(personas.map((p) => p.posicion_politica)),
    ZONES: { UAI: [1, ['Peñalolén']] },
  };
  return { panel, spec };
}

export function itemsDesdeInstrumento(inst: Instrumento) {
  const todos: ItemMirofish[] = inst.propuestas.map((p) => {
    if (!p.polo) throw new Error(`la propuesta ${p.id} no tiene polo`);
    return {
      id: p.id, scale: 'choice', topic: p.tema ?? p.texto,
      context: `En Chile se discute este tema: ${(p.tema ?? p.texto).replace(/[0-9%]/g, '')}. Hay dos posiciones en juego.`,
      question: '¿Cuál se acerca más a lo que piensas?',
      options: [
        { letter: 'A', text: p.texto }, { letter: 'B', text: p.polo },
        { letter: 'C', text: 'Ninguna de las dos' }, { letter: 'D', text: 'No sé' },
      ],
    };
  });
  return { question: todos[0], items: todos.slice(1) };
}

export function validarResultadosMirofish(json: unknown, refsValidos: Set<string>, propuestas: Set<string>) {
  const errores: string[] = [];
  const crudas = (json as { personas?: unknown })?.personas;
  if (!Array.isArray(crudas)) return { personas: [] as DocPersona[], errores: ['el archivo no tiene "personas"'] };
  const personas: DocPersona[] = [];
  for (const c of crudas as (Persona & { votos?: Record<string, unknown> })[]) {
    if (!refsValidos.has(c.ref)) { errores.push(`ref desconocido: ${c.ref}`); continue; }
    if (c.via !== 'mirofish' || !['avatar', 'avatar_red'].includes(c.fuente)) { errores.push(`persona no es de MiroFish: ${c.id}`); continue; }
    const votos: Record<string, number> = {};
    for (const [k, v] of Object.entries(c.votos ?? {})) if (propuestas.has(k) && [1, 2, 3, 4, 5].includes(v as number)) votos[k] = v as number;
    const { votos: _v, ...persona } = c;
    personas.push({ ...persona, votos });
  }
  return { personas, errores };
}
```

- [ ] **Step 4: Run test to verify it passes** — same command. Expected: PASS.

- [ ] **Step 5: Scripts (delgados; corren en WSL con ADC, como `scripts/diagnostico.ts`)**

```ts
// scripts/avatares-mirofish-export.ts
// Uso: npx tsx scripts/avatares-mirofish-export.ts <CODE>
// Escribe en mirofish/projects/ayd14/runs/<CODE>/: panel.json, panel_spec.json, items.json (question + items).
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { itemsDesdeInstrumento, panelDesdePlanillas } from '../src/lib/avatares/mirofishPuente';
import type { DocPlanilla } from '../src/lib/avatares/sala';

const code = (process.argv[2] ?? '').toUpperCase();
if (!code) throw new Error('uso: avatares-mirofish-export.ts <CODE>');
admin.initializeApp({ projectId: 'ml2-master-game' });
const db = admin.firestore();
const run = (await db.collection('avataresRuns').doc(code).get()).data();
if (!run) throw new Error(`sala ${code} no existe`);
const planillas = (await db.collection('avataresRuns').doc(code).collection('planillas').get()).docs.map((d) => d.data() as DocPlanilla);
const { panel, spec } = panelDesdePlanillas(planillas, code);
const items = itemsDesdeInstrumento(run.instrumento);
const dir = path.resolve('/mnt/c/Users/naim.bro.k/claude_projects/mirofish/projects/ayd14/runs', code);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'panel.json'), JSON.stringify(panel, null, 1));
fs.writeFileSync(path.join(dir, 'panel_spec.json'), JSON.stringify(spec, null, 1));
fs.writeFileSync(path.join(dir, 'items.json'), JSON.stringify(items, null, 1));
console.log(`exportado: ${panel.size} personas, ${items.items.length + 1} items -> ${dir}`);
```

```ts
// scripts/avatares-mirofish-import.ts
// Uso: npx tsx scripts/avatares-mirofish-import.ts <CODE>
// Lee mirofish/results/ayd14/<CODE>/resultados_contrato.json y escribe personas en la sala.
import admin from 'firebase-admin';
import fs from 'node:fs';
import { validarResultadosMirofish } from '../src/lib/avatares/mirofishPuente';
import type { DocPlanilla } from '../src/lib/avatares/sala';

const code = (process.argv[2] ?? '').toUpperCase();
if (!code) throw new Error('uso: avatares-mirofish-import.ts <CODE>');
admin.initializeApp({ projectId: 'ml2-master-game' });
const db = admin.firestore();
const runRef = db.collection('avataresRuns').doc(code);
const run = (await runRef.get()).data();
if (!run) throw new Error(`sala ${code} no existe`);
const refs = new Set((await runRef.collection('planillas').get()).docs.map((d) => (d.data() as DocPlanilla).ref));
const props = new Set<string>(run.instrumento.propuestas.map((p: { id: string }) => p.id));
const json = JSON.parse(fs.readFileSync(`/mnt/c/Users/naim.bro.k/claude_projects/mirofish/results/ayd14/${code}/resultados_contrato.json`, 'utf8'));
const { personas, errores } = validarResultadosMirofish(json, refs, props);
for (const e of errores) console.warn('aviso:', e);
const batch = db.batch();
for (const p of personas) batch.set(runRef.collection('personas').doc(p.id), p);
await batch.commit();
console.log(`importadas ${personas.length} personas de MiroFish en ${code}`);
```

- [ ] **Step 6: Tipos**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && source ~/.nvm/nvm.sh && nvm use 20.19.5 && npx tsc -b && npx vitest run src/lib/avatares"`
Expected: limpio y en verde. (Los scripts se ejercitan en la Task 15.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/avatares/mirofishPuente.ts src/lib/avatares/mirofishPuente.test.ts scripts/avatares-mirofish-export.ts scripts/avatares-mirofish-import.ts
git commit -m "feat(avatares): puente con MiroFish, panel seudonimizado e importacion validada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Línea `ayd14` en MiroFish (M5, lado MiroFish)

Repo: `C:\Users\naim.bro.k\claude_projects\mirofish`. Rama: `feat/ayd14` (crear desde la rama actual con `git switch -c feat/ayd14`; revisar `git status` antes y no arrastrar cambios ajenos). Leer `CLAUDE.md` entero antes de empezar.

**Files:**
- Create: `projects/ayd14/__init__.py` (vacío), `projects/ayd14/config.py`, `projects/ayd14/panel_spec.py`
- Create: `ayd14/__init__.py` (vacío), `ayd14/paths.py`, `ayd14/semilla.py`, `ayd14/mirofish.py`
- Create: `scripts/run_ayd14.sh`
- Test: `tests/test_ayd14.py`

**Interfaces:**
- Consumes: `runs/<CODE>/{panel.json, panel_spec.json, items.json}` (Task 12); `weekly.line.Line`, `weekly.baseline.run_items`, `weekly.run_week.run`, `weekly.question.PROMPT_SHA256`, `weekly.question.mirofish_llm_client`, `weekly.approve.is_approved`, `weekly.answers.parse_letter`
- Produces:
  - `python -m ayd14.mirofish prepare <CODE>` → `results/ayd14/<CODE>/{pack_kb.json, question.json, items_in.json}`
  - `python -m ayd14.mirofish simulate <CODE> [--replicates N] [--rounds N]` → línea base en paralelo + réplicas
  - `python -m ayd14.mirofish freeze <CODE>`
  - `python -m ayd14.mirofish resultados <CODE>` → `results/ayd14/<CODE>/resultados_contrato.json` con `{"personas": [...]}` (forma de `DocPersona`)
  - `semilla.pack_desde(items: dict, extra: list[dict], code: str) -> dict` (forma de pack)
  - `mirofish.valor_de_letra(letra: str | None) -> int` (A→5, B→1, otro→3)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_ayd14.py
import json

import pytest

from ayd14 import mirofish as am
from ayd14 import semilla


ITEMS = {
    "question": {"id": "p1", "scale": "choice", "topic": "Salario", "context": "En Chile se discute este tema: Salario.",
                 "question": "¿Cuál se acerca más a lo que piensas?",
                 "options": [{"letter": "A", "text": "Subir"}, {"letter": "B", "text": "Mantener"},
                             {"letter": "C", "text": "Ninguna de las dos"}, {"letter": "D", "text": "No sé"}]},
    "items": [{"id": "p2", "scale": "choice", "topic": "Clima", "context": "En Chile se discute este tema: Clima.",
               "question": "¿Cuál se acerca más a lo que piensas?",
               "options": [{"letter": "A", "text": "Priorizar"}, {"letter": "B", "text": "Crecer"},
                           {"letter": "C", "text": "Ninguna de las dos"}, {"letter": "D", "text": "No sé"}]}],
}


def test_valor_de_letra():
    assert [am.valor_de_letra(x) for x in ("A", "B", "C", "D", None)] == [5, 1, 3, 3, 3]


def test_pack_desde_tiene_forma_de_pack_y_no_lleva_respuestas():
    p = semilla.pack_desde(ITEMS, [{"titulo": "IA y valores", "resumen_ejecutivo": "Resumen propio.", "subthemes": []}], "ABC123")
    assert p["metadata"]["week_start"] and p["metadata"]["week_end"]
    titulos = [t["titulo"] for t in p["temas_dominantes"]]
    assert titulos == ["Salario", "Clima", "IA y valores"]
    assert p["temas_dominantes"][0]["cleavage"] == "Subir vs. Mantener"
    assert "votos" not in json.dumps(p)


def test_prepare_escribe_question_items_y_pack(tmp_path, monkeypatch):
    run = tmp_path / "runs" / "ABC123"
    run.mkdir(parents=True)
    (run / "items.json").write_text(json.dumps(ITEMS), encoding="utf-8")
    monkeypatch.setattr(am.paths, "RUNS_DIR", tmp_path / "runs")
    monkeypatch.setattr(am.paths, "RESULTS_DIR", tmp_path / "results")
    out = am.prepare("ABC123")
    q = json.loads((out / "question.json").read_text(encoding="utf-8"))
    assert q["generation"]["record"] == "p1"
    assert json.loads((out / "items_in.json").read_text(encoding="utf-8"))["items"][0]["id"] == "p2"
    assert (out / "pack_kb.json").exists()


def test_resultados_traduce_letras_al_contrato(tmp_path, monkeypatch):
    out = tmp_path / "results" / "ABC123"
    out.mkdir(parents=True)
    monkeypatch.setattr(am.paths, "RESULTS_DIR", tmp_path / "results")
    (out / "question.json").write_text(json.dumps({**ITEMS["question"], "generation": {"record": "p1"}}), encoding="utf-8")
    base = {"items": {
        "p1": {"conditions": {"as_is": {"per_persona": {"r1": {"letter": "A"}}}, "reversed": {"per_persona": {"r1": {"letter": "A"}}}}},
        "p2": {"conditions": {"as_is": {"per_persona": {"r1": {"letter": "B"}}}, "reversed": {"per_persona": {"r1": {"letter": "D"}}}}},
    }}
    (out / "baseline.json").write_text(json.dumps(base), encoding="utf-8")
    (out / "panel_map.json").write_text(json.dumps({"7": "r1"}), encoding="utf-8")
    (out / "replicate_1.json").write_text(json.dumps({"answers": {"7": "B: no"}, "items": {"p2": {"7": "A: sí"}}}), encoding="utf-8")
    personas = am.resultados("ABC123")["personas"]
    base_r1 = next(p for p in personas if p["id"] == "mb_r1")
    assert base_r1["votos"] == {"p1": 5, "p2": 2}           # B=1 y D=3 promedian 2
    red = next(p for p in personas if p["id"] == "mr1_r1")
    assert red["votos"] == {"p1": 1, "p2": 5}
    assert red["fuente"] == "avatar_red" and red["replica"] == 1 and red["via"] == "mirofish"


def test_simulate_se_niega_sin_aprobacion(monkeypatch):
    monkeypatch.setattr(am.paths, "RESPONDENT_APPROVAL", None)
    with pytest.raises(SystemExit):
        am.main(["simulate", "ABC123"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl.exe -e bash -lc "cd ~/... "` — usar el intérprete del proyecto como el resto de los tests de MiroFish: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/mirofish && . scripts/lib.sh && \$MF/backend/.venv/bin/python -m pytest tests/test_ayd14.py -q"`
Expected: FAIL, `No module named 'ayd14'`.

- [ ] **Step 3: Implementar**

```python
# ayd14/paths.py
"""Rutas de la línea ayd14 (Semana 14, IA y Democracia 2026; spec del juego 2026-11-07, M5)."""
from weekly import config

RUNS_DIR = config.PROJECT / "projects" / "ayd14" / "runs"
RESULTS_DIR = config.PROJECT / "results" / "ayd14"
SEMILLA_EXTRA = config.PROJECT / "projects" / "ayd14" / "semilla_extra.json"
# CLAUDE.md, "Recorded approvals", 2026-11-07. None = sin aprobación: simulate se niega.
RESPONDENT_APPROVAL: str | None = (
    "2026-11-07: Naim approved sending the pseudonymised avatar sheets of IA y Democracia 2026, week 14, to Gemini "
    "(paid key only) as agent personas for the MiroFish S14 run; never to Zep; never the students' item answers.")
# Contenido de la semilla (instrumento + resúmenes propios de prensa) hacia Gemini y Zep: requiere su propia
# aprobación (decisión E4). None = simulate se niega.
SEED_APPROVAL: str | None = None
```

```python
# ayd14/semilla.py
"""La semilla como pack (forma de weekly.seed/oleada.kb_seed): un tema por propuesta, con su clivaje texto vs.
polo, más temas extra editoriales (decisión E4). Nunca contiene respuestas de alumnos."""
def _tema(item: dict) -> dict:
    a, b = item["options"][0]["text"], item["options"][1]["text"]
    return {"titulo": item["topic"], "resumen_ejecutivo": f"Se discute en Chile: {a} Otros sostienen: {b}",
            "cleavage": f"{a} vs. {b}", "subthemes": [], "evidencia_principal": [], "fuentes": []}


def pack_desde(items: dict, extra: list[dict], code: str) -> dict:
    temas = [_tema(i) for i in [items["question"], *items["items"]]]
    for e in extra:
        temas.append({"titulo": e["titulo"], "resumen_ejecutivo": e.get("resumen_ejecutivo", ""),
                      "cleavage": e.get("cleavage", ""), "subthemes": list(e.get("subthemes", [])),
                      "evidencia_principal": [], "fuentes": list(e.get("fuentes", []))})
    return {
        "metadata": {"version": "ayd14-1", "week_label": code, "week_start": "2026-11-02", "week_end": "2026-11-09",
                     "window_mode": "ayd14", "as_of": "2026-11-09", "generated_at": ""},
        "executive_snapshot": {"headline": "Temas de la Semana 14: " + "; ".join(t["titulo"] for t in temas),
                               "claves": [t["resumen_ejecutivo"] for t in temas], "que_cambio": "", "que_mirar": ""},
        "temas_dominantes": temas,
        "evidencia": {"news_articles_used": []},
        "generation": {"source": "ayd14", "code": code},
        "manual_edits": [],
    }
```

```python
# projects/ayd14/config.py
"""La línea ayd14: alumnos reales (planillas seudonimizadas) como agentes. El panel y su spec se leen del run."""
from ayd14 import paths
from weekly.line import Line

REQUIREMENT = ("Simular cómo conversan y cambian de opinión estudiantes universitarios chilenos de un curso sobre IA y "
               "democracia ante los temas políticos descritos en el documento, durante un día.")
LINE = Line(name="ayd14", results_dir=paths.RESULTS_DIR, site_subdir="ayd14", project_prefix="ayd14",
            requirement=REQUIREMENT)
```

```python
# projects/ayd14/panel_spec.py
"""Spec del panel ayd14, generada desde el panel exportado (marginales exactas por construcción).
ayd14.mirofish fija AYD14_RUN antes de importarla; validate_panel la lee como un módulo de spec normal."""
import json
import os

from ayd14 import paths

_spec = json.loads((paths.RUNS_DIR / os.environ["AYD14_RUN"] / "panel_spec.json").read_text(encoding="utf-8"))
SIZE = _spec["SIZE"]
SEX = _spec["SEX"]
AGE = _spec["AGE"]
EDU = _spec["EDU"]
POL = _spec["POL"]
ZONES = {k: (v[0], v[1]) for k, v in _spec["ZONES"].items()}
```

```python
# ayd14/mirofish.py
"""Línea ayd14 (spec del juego 2026-11-07, M5).

  prepare <CODE>     results/ayd14/<CODE>/{pack_kb.json, question.json, items_in.json} desde runs/<CODE>/items.json
                     y la semilla extra; después: python -m weekly.approve <CODE> --results-dir results/ayd14/<CODE>
  simulate <CODE>    línea base (en un hilo, en paralelo) + réplicas MiroFish (backend arriba: scripts/run_ayd14.sh)
  freeze <CODE>      freeze.json con sha256 de las entradas
  resultados <CODE>  resultados_contrato.json: personas del contrato del juego (A=5, B=1, C/D=3)
"""
import argparse
import hashlib
import json
import os
import sys
import threading
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from ayd14 import paths, semilla

MODELO = "gemini-2.5-flash-lite"
FREEZE_FILES = ("question.json", "items_in.json", "pack_kb.json", "panel.json")


def valor_de_letra(letra):
    return {"A": 5, "B": 1}.get(letra, 3)


def _out(code: str) -> Path:
    return Path(paths.RESULTS_DIR) / code


def prepare(code: str) -> Path:
    from weekly import question
    run = Path(paths.RUNS_DIR) / code
    items = json.loads((run / "items.json").read_text(encoding="utf-8"))
    extra = json.loads(paths.SEMILLA_EXTRA.read_text(encoding="utf-8")) if Path(paths.SEMILLA_EXTRA).exists() else []
    out = _out(code)
    out.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(semilla.pack_desde(items, extra, code), ensure_ascii=False, indent=1).encode("utf-8")
    (out / "pack_kb.json").write_bytes(raw)
    q = {k: items["question"][k] for k in ("topic", "context", "question", "options")}
    q["source_sha256"] = hashlib.sha256(raw).hexdigest()
    q["generation"] = {"source": "ayd14", "record": items["question"]["id"], "prompt_sha256": question.PROMPT_SHA256}
    (out / "question.json").write_text(json.dumps(q, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "items_in.json").write_text(json.dumps({"items": items["items"]}, ensure_ascii=False, indent=1), encoding="utf-8")
    if (run / "panel.json").exists():
        (out / "panel.json").write_bytes((run / "panel.json").read_bytes())
    print(f"preparado: {out}; apruebe: python -m weekly.approve {code} --results-dir {out}")
    return out


def _linea(code: str):
    from projects.ayd14 import config as c
    out = _out(code)
    extra = json.loads((out / "items_in.json").read_text(encoding="utf-8"))["items"]
    return replace(c.LINE, results_dir=Path(paths.RESULTS_DIR), extra_items=tuple(extra), pack_path=out / "pack_kb.json",
                   panel_file=Path(paths.RUNS_DIR) / code / "panel.json", panel_spec="projects.ayd14.panel_spec")


def freeze(code: str) -> dict:
    out = _out(code)
    faltan = [f for f in FREEZE_FILES if not (out / f).exists()]
    if faltan:
        raise SystemExit(f"faltan {faltan} en {out}")
    rec = {"frozen_at": datetime.now(ZoneInfo("America/Santiago")).isoformat(timespec="seconds"),
           "sha256": {f: hashlib.sha256((out / f).read_bytes()).hexdigest() for f in FREEZE_FILES}}
    (out / "freeze.json").write_text(json.dumps(rec, indent=1), encoding="utf-8")
    return rec


def simulate(code: str, replicates: int, rounds: int) -> int:
    from weekly import approve as wapprove
    from weekly import baseline, config, panel, question, run_week
    if config.MODEL != MODELO:
        raise SystemExit(f"modelo fijado distinto de {MODELO}: {config.MODEL}")
    os.environ["AYD14_RUN"] = code
    out = _out(code)
    ln = _linea(code)
    pnl = panel.load_panel(ln.panel_file)
    errs = panel.validate_panel(pnl, panel.spec_module(ln.panel_spec))
    if errs:
        raise SystemExit(f"panel inválido: {errs}")
    q = json.loads((out / "question.json").read_text(encoding="utf-8"))
    if not wapprove.is_approved(q):
        raise SystemExit(f"question.json sin aprobar: python -m weekly.approve {code} --results-dir {out}")
    topical = {"id": q["generation"]["record"], **{k: q[k] for k in ("topic", "context", "question", "options")}}
    # La línea base no necesita la simulación: corre en paralelo para ahorrar ~10 min en clase.
    error_base = []
    def _base():
        try:
            baseline.run_items(code, [topical, *ln.extra_items], pnl, question.mirofish_llm_client(), results_dir=out)
        except Exception as ex:  # noqa: BLE001 - se informa al final, no tumba las réplicas
            error_base.append(ex)
    hilo = threading.Thread(target=_base, daemon=True)
    hilo.start()
    rc = run_week.run(code, replicates, rounds, question_only=False, seed_variant="medium", line=ln, resume=False)
    hilo.join()
    if error_base:
        print(f"línea base falló: {error_base[0]}", file=sys.stderr)
        return 1
    return rc


def resultados(code: str) -> dict:
    out = _out(code)
    q = json.loads((out / "question.json").read_text(encoding="utf-8"))
    topical_id = q["generation"]["record"]
    personas: dict[str, dict] = {}
    base = json.loads((out / "baseline.json").read_text(encoding="utf-8"))
    for item_id, it in base["items"].items():
        conds = it["conditions"]
        refs = set(conds["as_is"]["per_persona"]) | set(conds["reversed"]["per_persona"])
        for ref in refs:
            vals = [valor_de_letra(conds[o]["per_persona"].get(ref, {}).get("letter")) for o in ("as_is", "reversed")]
            p = personas.setdefault(f"mb_{ref}", {"id": f"mb_{ref}", "ref": ref, "fuente": "avatar", "via": "mirofish",
                                                  "modelo": MODELO, "condicion": "base", "votos": {}})
            p["votos"][item_id] = round(sum(vals) / len(vals))
    from weekly.answers import parse_letter
    mapa = json.loads((out / "panel_map.json").read_text(encoding="utf-8"))
    letras = ["A", "B", "C", "D"]
    for f in sorted(out.glob("replicate_[0-9]*.json")):
        stem = f.stem.split("_")
        if len(stem) != 2:          # replicate_1_a1.json son intentos archivados
            continue
        k = int(stem[1])
        rep = json.loads(f.read_text(encoding="utf-8"))
        respuestas = {topical_id: rep.get("answers", {}), **rep.get("items", {})}
        for item_id, por_agente in respuestas.items():
            for aid, texto in por_agente.items():
                ref = mapa.get(str(aid))
                if not ref:
                    continue
                pid = f"mr{k}_{ref}"
                p = personas.setdefault(pid, {"id": pid, "ref": ref, "fuente": "avatar_red", "via": "mirofish",
                                              "modelo": MODELO, "replica": k, "votos": {}})
                p["votos"][item_id] = valor_de_letra(parse_letter(texto, letras))
    res = {"personas": list(personas.values())}
    (out / "resultados_contrato.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    return res


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m ayd14.mirofish")
    ap.add_argument("cmd", choices=["prepare", "simulate", "freeze", "resultados"])
    ap.add_argument("code")
    ap.add_argument("--replicates", type=int, default=3)
    ap.add_argument("--rounds", type=int, default=12)
    a = ap.parse_args(sys.argv[1:] if argv is None else argv)
    if a.cmd == "prepare":
        prepare(a.code)
        return 0
    if a.cmd == "freeze":
        print(json.dumps(freeze(a.code), indent=1))
        return 0
    if a.cmd == "resultados":
        print(f"{len(resultados(a.code)['personas'])} personas -> {_out(a.code) / 'resultados_contrato.json'}")
        return 0
    if paths.RESPONDENT_APPROVAL is None:
        raise SystemExit("ayd14.paths.RESPONDENT_APPROVAL es None: falta la aprobación de Naim (CLAUDE.md)")
    if paths.SEED_APPROVAL is None:
        raise SystemExit("ayd14.paths.SEED_APPROVAL es None: falta la aprobación de Naim para la semilla (decisión E4)")
    return simulate(a.code, a.replicates, a.rounds)


if __name__ == "__main__":
    sys.exit(main())
```

Antes de dar por cerrado `simulate`: confirmar leyendo `weekly/config.py` que la constante del modelo fijado se llama `MODEL` (si se llama distinto, usar ese nombre) y que `weekly.question.mirofish_llm_client` existe con esa firma (la usa `oleada/mirofish.py`). Si `config.MODEL` no existe, eliminar ese chequeo y dejar el modelo fijado como lo deja el motor.

- [ ] **Step 4: Envoltorio**

```bash
#!/usr/bin/env bash
# scripts/run_ayd14.sh <CODE> --simulate [--replicates N] [--rounds N]
# Igual que run_oleada_week.sh: backend arriba con presupuesto, simulate, y SIEMPRE stop.sh al salir.
set -uo pipefail
cd "$(dirname "$0")/.."
CODE="${1:?uso: run_ayd14.sh <CODE> --simulate [args]}"; shift
MODE="${1:?falta el modo}"; shift
. scripts/lib.sh
PYBIN="$MF/backend/.venv/bin/python"
OUT="results/ayd14/$CODE"
mkdir -p "$OUT"
[ "$MODE" = "--simulate" ] || { echo "modo desconocido $MODE" >&2; exit 1; }
if scope_active proxy || scope_active backend; then echo "scopes activos; corra scripts/stop.sh primero" >&2; exit 1; fi
gate simulate || exit 1
trap 'scripts/stop.sh 2>&1 | tee -a "$LOG_DIR/stop_ayd14_${CODE}.log" >/dev/null; echo "servicios detenidos"' EXIT
LLM_LOG="$LOG_DIR/llm_calls.jsonl" MAX_CALLS="${MAX_CALLS:-4000}" MAX_TOKENS="${MAX_TOKENS:-30000000}" scripts/start.sh backend || exit 1
"$PYBIN" -u -m ayd14.mirofish simulate "$CODE" "$@" 2>&1 | tee "$OUT/run.log"
rc=${PIPESTATUS[0]}
curl -s http://127.0.0.1:5099/_proxy/stats > "$OUT/proxy_stats.json" || true
exit $rc
```

```bash
chmod +x scripts/run_ayd14.sh
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/mirofish && . scripts/lib.sh && \$MF/backend/.venv/bin/python -m pytest tests/test_ayd14.py -q && \$MF/backend/.venv/bin/python -m pytest -q"`
Expected: los 5 tests nuevos y la suite existente en verde.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/naim.bro.k/claude_projects/mirofish
git add ayd14 projects/ayd14/__init__.py projects/ayd14/config.py projects/ayd14/panel_spec.py scripts/run_ayd14.sh tests/test_ayd14.py
git commit -m "feat(ayd14): linea MiroFish para la Semana 14 de IA y Democracia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

`projects/ayd14/runs/` y `results/ayd14/` contienen datos de alumnos: agregarlos a `.gitignore` en el mismo commit (`echo "projects/ayd14/runs/" >> .gitignore; echo "results/ayd14/" >> .gitignore`) y verificar con `git status` que no se commitea ningún panel real.

---

### Task 14: Corrida en seco de MiroFish con el panel sintético (medir el tiempo)

**Files:** ninguno nuevo (usa las Tasks 12 y 13). Requiere `SEED_APPROVAL` aprobado por Naim (decisión E4); con el panel sintético no viajan datos de alumnos.

**Interfaces:**
- Consumes: `sintetizar` (Task 6) para planillas sintéticas; `panelDesdePlanillas`, `itemsDesdeInstrumento` (Task 12); `ayd14.mirofish` (Task 13)
- Produces: `results/ayd14/SINT01/{run.log, proxy_stats.json, resultados_contrato.json}` y una nota con el tiempo medido en `docs/superpowers/plans/2026-11-07-avatares-deliberacion.md` (sección «Medido»)

- [ ] **Step 1: Escribir el run sintético**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx tsx -e \"
import fs from 'node:fs';
import { instrumentoDe } from './src/lib/avatares/instrumentos';
import { sintetizar } from './src/lib/avatares/sinteticos';
import { planillaComoTexto } from './src/lib/avatares/planilla';
import { panelDesdePlanillas, itemsDesdeInstrumento } from './src/lib/avatares/mirofishPuente';
const inst = instrumentoDe('ayd14_vina_v1')!;
const { planillas } = sintetizar(inst, { semilla: 7, n: 28 });
const docs = Object.entries(planillas).map(([ref, campos]) => ({ uid: 'x', ref, campos, texto: planillaComoTexto(inst, campos) }));
const { panel, spec } = panelDesdePlanillas(docs, 'SINT01');
const dir = '/mnt/c/Users/naim.bro.k/claude_projects/mirofish/projects/ayd14/runs/SINT01';
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(dir + '/panel.json', JSON.stringify(panel));
fs.writeFileSync(dir + '/panel_spec.json', JSON.stringify(spec));
fs.writeFileSync(dir + '/items.json', JSON.stringify(itemsDesdeInstrumento(inst)));
console.log('ok', panel.size);
\""
```

Expected: `ok 28`.

- [ ] **Step 2: Preparar, aprobar y congelar**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/mirofish && . scripts/lib.sh && P=\$MF/backend/.venv/bin/python && \$P -m ayd14.mirofish prepare SINT01 && \$P -m weekly.approve SINT01 --results-dir results/ayd14/SINT01"
```

Expected: `question.json` aprobado (el CLI de `weekly.approve` muestra la pregunta y pide confirmación; la confirma Naim o quien él indique).

- [ ] **Step 3: Correr con memoria vigilada** (seguir `CLAUDE.md`: `MemAvailable` ≥ 3000 MB, `scripts/memwatch.sh start`, una sola carga pesada)

```bash
MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/mirofish && scripts/memwatch.sh start && time scripts/run_ayd14.sh SINT01 --simulate --replicates 3 --rounds 12"
```

Correrlo en segundo plano. Expected: termina con código 0 y `servicios detenidos`.

- [ ] **Step 4: Resultados y tiempo**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/mirofish && . scripts/lib.sh && \$MF/backend/.venv/bin/python -m ayd14.mirofish resultados SINT01 && python3 -c \"import json;d=json.load(open('results/ayd14/SINT01/proxy_stats.json'));print(d)\""
```

Expected: `112 personas` (28 base + 3×28 réplicas) y el conteo de tokens. Anotar en este plan, sección «Medido», el tiempo real, los tokens y el costo (US$0,10 / 0,40 por millón). **Si pasa de 30 minutos**, bajar a `--replicates 2 --rounds 12` y volver a medir; si aun así no cabe, el plan B del spec manda (MiroFish se muestra el jueves).

- [ ] **Step 5: Limpiar** — `rm -rf projects/ayd14/runs/SINT01` no es necesario (sintético), pero sí confirmar `scripts/stop.sh` y que no quedan scopes `mirofish-*` vivos.

---

### Task 15: Despliegue y ensayo con dos cuentas

**Files:** ninguno nuevo.

- [ ] **Step 1: Verificación completa en el worktree**

Run: `MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && source ~/.nvm/nvm.sh && nvm use 20.19.5 && npx vitest run && npx tsc -b && npx eslint src && npm run build && npm run test:rules && (cd functions && npm run build && npx vitest run)"`
Expected: todo en verde.

- [ ] **Step 2: Pedir OK a Naim** para: (a) desplegar reglas, (b) desplegar la Function `votarComoAvatares`, (c) fusionar `feat/avatares-s14` en `main` y hacer push (despliega el sitio). Sin OK, no seguir.

- [ ] **Step 3: Desplegar (con OK)**

```bash
MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares && npx firebase deploy --only firestore:rules"
MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "rm -rf /tmp/functions-deploy && cp -r /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares/functions /tmp/functions-deploy && cp /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-avatares/firebase.json /tmp/ && cd /tmp/functions-deploy && npm ci && cd /tmp && npx firebase deploy --only functions:votarComoAvatares --project ml2-master-game"
```

(Seguir el procedimiento exacto que documenta `CLAUDE.md` del juego para `/tmp/functions-deploy`; si difiere de lo de arriba, manda el de `CLAUDE.md`.)

```bash
cd /c/Users/naim.bro.k/claude_projects/games/ml2-master-game
git fetch . feat/avatares-s14 && git merge --no-ff feat/avatares-s14 -m "Merge feat/avatares-s14: actividad de avatares de la Semana 14"
git push origin main
```

(El merge en `main` no toca los archivos sin commitear de la clase 05; si git se niega, parar y avisar.)

- [ ] **Step 4: Ensayo con dos cuentas reales** (memoria: nunca la misma cuenta en dos dispositivos)
  1. Naim crea la sala en `/professor/avatares/nuevo` y proyecta `/avatares/<CODE>/sala`.
  2. Una segunda cuenta entra por el QR, llena la planilla y la encuesta; recarga el teléfono a mitad y verifica que no pierde nada.
  3. Naim pulsa «Generar avatares»: aparecen 1 × 3 avatares; revisar `faltantes` vacíos en Firestore.
  4. Exportar a MiroFish (`npx tsx scripts/avatares-mirofish-export.ts <CODE>`) y verificar que `panel.json` no contiene el nombre, el uid ni la ciudad de la cuenta de prueba.
  5. Importar `results/ayd14/SINT01` no aplica (refs distintos): verificar que el import de una sala sin resultados falla con un mensaje claro.
  6. Pasar a «Resultados»: las cuatro pestañas se ven, sin nombres.
  7. Borrar la sala de prueba (es del anfitrión).

- [ ] **Step 5: Guion del lunes en una nota** (`docs/superpowers/plans/2026-11-07-avatares-deliberacion.md`, sección «Lunes»): comandos exactos en orden, con el código de la sala como variable: crear sala → fase planilla → al cerrar: «Generar avatares» + export + `prepare` + `weekly.approve` + `freeze` + `run_ayd14.sh` en segundo plano → fase encuesta → deck → fase resultados → al terminar MiroFish: `resultados` + import.

---

## Medido

(Se completa en la Task 14.)

## Lunes

(Se completa en la Task 15.)
