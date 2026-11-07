# Avatares, deliberación simulada y puentes — núcleo (AyD 2026, Semana 14)

- **Fecha:** 2026-11-07 (sábado). **Uso:** clase del lunes 9-nov-2026, IA y Democracia 2026.
- **Repos:** `games/ml2-master-game` (app) y `claude_projects/mirofish` (deliberación simulada).
- **Alcance de este spec:** el núcleo que se puede construir sin cerrar las decisiones editoriales
  (sección 9). Las pantallas finales y el guion de la revelación vienen después.

## 1. Propósito

En una sola clase, contrastar tres formas de agregar preferencias en tiempos de IA, con los datos
de la sala:

1. **Avatares que votan (Hidalgo).** Un avatar por alumno vota propuesta por propuesta. ¿El
   «parlamento de avatares» aprueba lo mismo que la sala?
2. **Deliberación simulada (MiroFish).** El mismo alumno como agente, solo (línea base) y después
   de conversar en una red simulada (réplicas). ¿Deliberar acerca al avatar a su humano o lo
   homogeneiza hacia los valores del modelo?
3. **Mapa latente y puentes (Evans y Weyl, Polis, Community Notes).** Personas **y propuestas** en
   un mismo espacio latente aprendido de los votos. Ranking por mayoría contra ranking por puente
   (apoyo entre grupos detectados, no predefinidos). Qué pasa al inundar con bots idénticos.

Alimenta la tribuna del jueves 12: «Un avatar entrenado con mis respuestas me representa mejor que
mi diputado».

**Éxito el lunes:** al cierre de la clase el proyector muestra, con los datos de la sala, al menos
las lecturas 1 y 3. La lectura 2 se muestra el lunes si la corrida termina; si no, el jueves
(plan B, sección 8).

## 2. Lo que dijo Naim (decidido)

- App propia y centralizada; **Naim envía los datos al LLM**, seudonimizados.
- Todo ocurre el lunes en clase. MiroFish va, con plan B.
- Consentimiento: lo dice Naim oralmente. **La app no agrega texto de consentimiento.**
- Autorización MiroFish registrada en `mirofish/CLAUDE.md` (2026-11-07): planillas seudonimizadas
  de S14 → Gemini con clave pagada, como personas; nada de personas a Zep.

## 3. Decisiones menores tomadas (avisadas)

- La app es un **módulo nuevo de ml2-master-game**, hermano del compás: reutiliza `ConSesion`,
  QR, login con Google, Firestore, Functions con sus secretos y el despliegue. No es una sesión de
  juego: no puntúa ni rankea (misma regla 1 del compás).
- El uid empareja planilla, respuestas y avatar dentro de la app. **No hay código seudónimo que
  tipear.** Hacia fuera (LLM, MiroFish, exportaciones) cada alumno es un `ref` opaco
  (hash con sal del uid y el código de sala).
- Escala de voto: Likert 1–5. «Aprueba» = 4 o 5. Compatible con Viña.
- El mapa común se ajusta **sobre los humanos** y las demás fuentes se proyectan en él, para que
  todas las nubes estén en las mismas coordenadas. Los rankings de cada «cámara» se calculan con
  sus propios grupos.
- MiroFish corre como **línea nueva** `projects/ayd14/`, sin tocar el panel de `oleadas`.

## 4. Arquitectura por módulos

```
           M6 sintéticos ──┐
                           ▼
 M1 app ──► Firestore ──► M0 contrato (matriz) ──► M3 analítica ──► M4 pantallas
   │            ▲   ▲
   ▼            │   └── M5 importa réplicas ◄── MiroFish (WSL, 127.0.0.1)
 M2 avatares ───┘                ▲
 (Functions)        M5 exporta planillas seudonimizadas
```

Cada módulo se prueba solo. Todos hablan a través de M0.

### M0 — Contrato de datos

Tipos en `src/lib/avatares/contrato.ts`; el mismo esquema en JSON para Python (MiroFish).

```ts
Instrumento { id, version, escala: {min: 1, max: 5, aprueba: 4},
              planilla: CampoPlanilla[], propuestas: Propuesta[] }
CampoPlanilla { id, etiqueta, tipo: 'texto' | 'opcion' | 'escala', opciones?, sensible?: boolean }
Propuesta   { id, texto, origen: 'instrumento' | 'alumno' | 'llm', autorRef?: string,
              tema?: string, polo?: string }   // polo = la posición contraria con nombre (MiroFish)
Persona     { id, ref, fuente: 'humano' | 'avatar' | 'avatar_red' | 'bot',
              via: 'app' | 'mirofish' | 'simulado', modelo?, replica?, condicion? }
Voto        { persona, propuesta, valor: 1..5 }        // matriz con huecos permitidos
Matriz      { instrumento, personas: Persona[], votos: Voto[] }
```

- `ref` une a un humano con todos sus avatares (app, MiroFish base, MiroFish réplica k).
- Huecos permitidos: en modo propuestas abiertas cada humano vota un subconjunto.
- La línea base de MiroFish es `fuente: 'avatar', via: 'mirofish'`; su contraste limpio es contra
  `avatar_red` del mismo modelo y la misma persona.
- `exportarMatriz(code)` produce el JSON; `validarMatriz()` rechaza valores fuera de escala, refs
  huérfanos y propuestas inexistentes.

### M1 — App de recolección

Rutas (todas bajo `ConSesion`):

| Ruta | Quién | Qué |
|---|---|---|
| `/professor/avatares/nuevo` | Naim | Crea la sala con un instrumento. |
| `/avatares/:code` | Alumno | Planilla → encuesta humana (→ propuestas, si se elige ese modo). |
| `/avatares/:code/sala` | Proyector | QR, conteos, fases, resultados. Nunca nombres. |

- Fases que mueve el anfitrión: `lobby → planilla → encuesta → [propuestas] → resultados`.
- El alumno **no ve** los votos de su avatar antes de responder la encuesta humana.
- El instrumento es un JSON en `content/avatares/ai_democracy_2026/`, registrado como el compás.
  La app renderiza cualquier instrumento; el contenido de relleno son los 12 ítems y la planilla de
  Viña.

Firestore:

- `avataresRuns/{code}`: `hostId, courseId, instrumentoId, fase, config {modelos, …},
  participantes {uid: {nombre?, planilla: bool, encuesta: n}}`.
- `avataresRuns/{code}/planillas/{uid}`: campos de la planilla. Escribe el dueño; lee el anfitrión.
- `avataresRuns/{code}/personas/{personaId}`: `Persona` + `votos {propuestaId: valor}`. Los
  humanos los escribe el dueño; avatares e importaciones, Functions o el anfitrión.
- `avataresRuns/{code}/propuestas/{id}`: solo en modo propuestas abiertas.
- Reglas con pruebas en el emulador, siguiendo `scripts/test-compas-rules.mjs`.

### M2 — Avatares (Functions)

- Callable `votarComoAvatares({code})`, solo anfitrión. Por cada planilla y cada modelo de
  `config.modelos`: una llamada con la planilla (sin nombre, uid ni correo) y todas las propuestas;
  salida JSON `{propuestaId: 1..5}`; validación y un reintento; los fallos quedan marcados, no
  bloquean.
- Proveedores: los clientes que ya existen en `functions/src/index.ts` (`getOpenAI`,
  `getAnthropic`, `getGemini`). El modelo es un parámetro; nada de modelo fijo en el código.
- Llamadas en paralelo con tope; ~25 alumnos × 1–3 modelos = 25–75 llamadas, segundos y centavos.
- En modo propuestas abiertas se vuelve a llamar al cerrar esa fase, solo con las propuestas nuevas.
- Prompt versionado en el repo; se registra con cada persona (`condicion`).

### M3 — Analítica (funciones puras, TypeScript, con tests)

En `src/lib/avatares/analitica.ts`. Entrada: `Matriz` (y un filtro por fuente). Sin Firestore.

1. `aprobacion(matriz, fuente)` → por propuesta, % que aprueba. Qué aprueba cada cámara.
2. `correlacionPorPropuesta(matriz, fuenteA, fuenteB)` → Pearson pareado por `ref`, y promedio.
   Reproduce el análisis de Viña.
3. `mapaPCA(matriz, ajustarCon='humano')` → 2D; huecos imputados con la media de la propuesta;
   proyecta las demás fuentes en el mismo espacio. Incluye las cargas de las propuestas (biplot).
4. `grupos(puntos)` → k-means determinista, k ∈ {2,3,4} elegido por silueta.
5. `puentePolis(matriz, grupos)` → por propuesta, mínimo entre grupos de la aprobación suavizada
   `(a+1)/(n+2)`, y el producto (consenso informado por grupos de Polis).
6. `factorizacionCN(matriz, dim=1)` → `valor ≈ μ + b_persona + b_propuesta + f_persona·f_propuesta`,
   con valores reescalados a [0,1] (`(v−1)/4`), λ_intercepto = 0,15 y λ_factor = 0,03, factor de
   una dimensión (verificado en `twitter/communitynotes`, `documentation/under-the-hood/ranking-notes.md`;
   allí «útil» exige intercepto ≥ 0,40 y |f| < 0,50). Devuelve
   `b_propuesta` (el **puntaje puente**) y `f_propuesta` (la polaridad). **Personas y propuestas
   quedan en el mismo espacio**: es la pantalla central.
7. `rankings(matriz, fuente)` → mayoría (1) contra puente (5 y 6) por cámara.
8. `inundar(matriz, personaId, n)` → agrega n copias idénticas y recalcula 1, 5 y 6. Se espera que
   la mayoría se mueva y el puente casi no, porque las copias caen en un solo punto.
9. `dispersion(matriz, fuente)` → varianza por propuesta. Mide la homogeneización
   (humanos contra avatares contra avatares en red).

### M4 — Pantallas del proyector

En este spec, solo lo mínimo para verificar el núcleo: una vista de resultados en
`/avatares/:code/sala` con el mapa (6), la tabla mayoría contra puente (7), las correlaciones (2) y
el botón de bots (8). El diseño y el orden de la revelación son la decisión E5.

### M5 — Puente con MiroFish

En `claude_projects/mirofish`, respetando su `CLAUDE.md` (memoria, 127.0.0.1, `scripts/start.sh`,
`memwatch`, `stop.sh` al final, modelo fijado, `platform: parallel`).

- Los scripts de exportar e importar viven en el repo del juego (`scripts/avatares-mirofish-*.ts`,
  que ya tiene firebase-admin con ADC en WSL) y leen o escriben en las rutas de MiroFish. Naim los
  lanza desde una terminal de WSL al cerrar la fase de planilla y al terminar la corrida.
- **Exportar:** lee las
  planillas de la sala → seudonimiza (sin nombre, uid ni correo; sin ciudad; edad en tramos) →
  `projects/ayd14/panel_ayd14_v1.json` en el esquema del panel (texto `persona` armado de forma
  determinista desde los campos, sin LLM) + `items_in.json` y `question.json` desde el instrumento.
  **MiroFish rechaza las escalas de acuerdo/desacuerdo** (`weekly/question.py`: miden aquiescencia,
  diagnóstico W39). Cada propuesta entra como elección forzada entre dos posiciones con nombre:
  A = `texto`, B = `polo`, C = «Ninguna de las dos», D = «No sé». En el contrato: A → 5, B → 1,
  C o D → 3. Por eso toda propuesta que vaya a MiroFish necesita `polo` (contenido: decisión E7).
  La inversión de orden para la mitad de los agentes ya existe.
  Las respuestas a los ítems **nunca** entran en la persona ni en la semilla.
- **Correr:** `run_oleada_week.sh` sobre la línea `ayd14`, con `--replicates 3 --rounds 12` como
  punto de partida, ajustado según el ensayo del domingo. Semilla enchufable (`seed.md`): decisión E4.
  `freeze` antes de importar.
- **Importar:** `baseline.json` y `replicate_N.json` → letra/texto a 1–5 → `Persona`
  (`avatar` vía mirofish y `avatar_red` con `replica`) → Firestore de la sala, con firebase-admin.
  La sala las muestra sin recargar nada más.

### M6 — Datos sintéticos

- Desde `mirofish/projects/oleadas/panel_estudiantes_v1.json` (40 estudiantes sintéticos; copiar
  el fixture al repo del juego): planillas sintéticas y votos humanos con una regla más ruido,
  semilla fija.
- Fuentes sintéticas de avatar con sesgos conocidos y configurables: corrimiento progresista y
  menos varianza; `avatar_red` aún más homogéneo. Sirven para probar que M3 detecta lo que debe.
- Ruta `/preview-avatares` sin login (como `/preview-compas`): toda la cadena con datos sintéticos.
  Es el ensayo de Naim y el respaldo visual en clase.

## 5. La clase del lunes (esqueleto; los minutos son la decisión E6)

1. QR → planilla (~10 min). Al cerrar la fase: `votarComoAvatares` y exportación a MiroFish.
2. Encuesta humana (~8 min), sin ver al avatar. MiroFish ya está corriendo.
3. Deck (Diella, Hidalgo, Innerarity, el gradiente, el sesgo) mientras corre MiroFish.
4. Revelación I: avatares contra humanos, mapa, mayoría contra puente, bots.
5. Revelación II: MiroFish, línea base contra réplicas, si terminó.

## 6. Datos y privacidad

- Al LLM (M2) y a Gemini (M5) va solo la planilla, sin nombre, uid ni correo. A Zep, solo la semilla.
- Nada proyectado lleva nombres. Planillas y votos humanos: los lee solo el anfitrión.
- Los resultados de MiroFish quedan en local (`results/ayd14/…`) y en la sala. Nada se publica.
- Claves: solo por Functions desplegadas (regla del repo); nunca en scripts locales ni en logs.

## 7. Pruebas

- Vitest para M0, M3 y M6. M3 se prueba contra casos construidos a mano (dos grupos opuestos más
  una propuesta que ambos apoyan: el puente la pone primera y la mayoría no necesariamente) y
  contra las fuentes sintéticas sesgadas.
- `npm run test:rules` extendido a `avataresRuns`.
- M2 con un proveedor simulado en tests; una llamada real por modelo en el ensayo.
- **Ensayo del domingo:** la sala completa con dos cuentas reales (nunca la misma cuenta en dos
  dispositivos) y una corrida MiroFish con el panel **sintético** para medir el tiempo real.
- `tsc -b`, eslint y build limpios antes de desplegar.

## 8. Riesgos y plan B

| Falla | Plan B |
|---|---|
| MiroFish no termina en clase o se cae (memoria, Zep) | Se muestran las lecturas 1 y 3; MiroFish se arregla en la semana y se muestra el jueves. |
| Falla el callable de avatares o un proveedor | Reintentar con otro modelo de `config.modelos`; en el peor caso, la lectura 3 solo con humanos (no necesita LLM). |
| Pocos alumnos (N≈20) | Los grupos se limitan a k ≤ 3; se avisa en pantalla. |
| Despliegue de Functions lento | Desplegar desde `/tmp/functions-deploy` en WSL el domingo, no el lunes. |
| La app se cae en clase | `/preview-avatares` con datos sintéticos para la explicación. |

Cada push a `main` (que despliega el sitio) y cada despliegue de Functions se hacen con el OK de
Naim.

## 9. Decisiones editoriales abiertas (no bloquean el núcleo)

| | Decisión | Por defecto si no se decide |
|---|---|---|
| E1 | Propuestas: ítems fijos, propuestas abiertas de los alumnos (Polis), o mezcla | Los 12 ítems de Viña |
| E2 | Planilla: la de Viña (pregunta por matrimonio y aborto, que también son ítems: se filtra parcialmente) o una revisada | La de Viña, por comparabilidad |
| E3 | Modelos del avatar: uno o varios («¿el avatar de quién?») | Tres: OpenAI, Anthropic, Gemini |
| E4 | Semilla de MiroFish: The Economist de la semana, dossier de prensa chilena por tema, argumentos anónimos de los alumnos como segunda condición | Las dos notas + dossier breve por tema |
| E5 | Pantallas y orden de la revelación | La vista mínima de M4 |
| E6 | Minutos de cada fase en la clase | El esqueleto de la sección 5 |
| E7 | El `polo` (posición contraria con nombre) de cada propuesta, para MiroFish | Borrador de Claude para los 12 ítems de Viña, que Naim corrige |

**Fuera de este spec:** embeddings semánticos del texto de las propuestas, la propuesta del
centroide redactada por un LLM (Habermas Machine), pol.is en vivo, la semana 15.
