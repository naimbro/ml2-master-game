# Doble orden en los duelos de recalibración — Design

**Date:** 2026-07-27
**Status:** Approved (alcance acordado con el usuario; implementación pendiente)
**Builds on:** `docs/superpowers/specs/2026-07-04-dramatic-recalibration-design.md` y
`docs/superpowers/specs/2026-07-05-live-recalibration-reveal-design.md` (la recalibración y su
reveal, ambos ya en producción).
**Paper:** Shibata & Miyamura (2025), *LCES: Zero-shot Automated Essay Scoring via Pairwise
Comparisons Using Large Language Models*, EMNLP 2025 main. Registro en
`docs/evaluacion_llm_literatura.md` (paper #5).

## Goal

Sacar el sesgo de posición de los duelos de recalibración. Hoy cada par de respuestas se compara
**una vez**, en un orden elegido por hash; medimos que **~1 de cada 5 duelos de producción lo
decide la posición y no la calidad**. Esos duelos reordenan alumnos al azar, que es exactamente lo
contrario de lo que la recalibración existe para hacer.

El arreglo es el paso 1 de LCES: consultar cada par en los **dos** órdenes y, si los veredictos se
contradicen, contar el par como empate.

Out of scope, con razón explícita:

- **Permitir "empate" en el prompt** (`buildComparePrompt`). La regla de LCES ya captura los pares
  genuinamente parejos por la vía dura, y su tasa de empate queda acotada por la de flip medida.
  Ofrecerle la salida fácil al modelo tiene tasa de empate no acotada: si abusa de ella, la
  recalibración se apaga. Descartado hasta tener evidencia de que hace falta.
- **RankNet** (paso 2 de LCES). Ver "Por qué no RankNet" al final.
- **Meter la ronda en el hash djb2.** Era el arreglo barato alternativo; con el doble orden el hash
  desaparece entero, así que queda sin objeto.

## La medición

Hecha con `scripts/bt-order-flip.ts` (nuevo, se queda en el repo), que reusa los ~2.000 veredictos
ya cacheados en `scripts/.cache/pairwise-*.jsonl` y corre **sólo el orden invertido** — la mitad
forward sale gratis porque la clave del caché incluye el orden de presentación.

200 pares de los 6 juegos canónicos, gpt-4o a temperatura 0, $0,47:

| Métrica | Valor |
|---|---|
| Los dos órdenes deciden y coinciden | 86,5% |
| **Se contradicen (flip)** | **13,5% ± 2,4pp** |
| Alguno responde empate | 0,0% |
| Latencia por llamada | mediana 612 ms · p90 1.127 ms |
| Costo por llamada | $0,0024 |

Cae dentro del rango que LCES §5.2 reporta para gpt-4o (10,4% ASAP / 17,0% TOEFL11). El número
ajeno transfiere.

**El sesgo tiene dirección:** 21 de los 27 flips (78%) favorecen a la **segunda** respuesta. No es
ruido simétrico, es una preferencia posicional sistemática. Concuerda con el `firstWinRate` de
0,458 promediado sobre las 16 rondas del reporte `bt-pairwise-report.html`.

**El flip se concentra donde el reordenamiento ocurre:**

| Δ puntaje provisional | n | flip |
|---|---|---|
| Δ<5 | 43 | **27,9%** |
| Δ5-15 | 78 | 12,8% |
| Δ15-30 | 47 | 6,4% |
| Δ≥30 | 32 | 6,3% |

**Y por eso el 13,5% subestima lo nuestro.** La muestra sale del schedule circulante de
`bt-pairwise.ts`, que empareja por índice. Producción usa Swiss B=4, que empareja **por cercanía de
puntaje, a propósito**. Reponderando las tasas por banda con la distribución real de distancias del
Swiss sobre las 16 rondas ranked (1.196 duelos, cálculo sin API):

```
Δ<5      714 duelos  59.7% del total   × flip 27.9%
Δ5-15    371 duelos  31.0% del total   × flip 12.8%
Δ15-30   101 duelos   8.4% del total   × flip  6.4%
Δ≥30      10 duelos   0.8% del total   × flip  6.3%
  → tasa de flip esperada en producción: 21.2%
```

El 21,2% es **proyección**, no medición directa: la tasa por banda está medida, la mezcla está
calculada exacta, el producto es una estimación. El 13,5% es lo medido.

El schedule Swiss está optimizado para el drama y eso lo mete de lleno en el régimen ruidoso. Es
un efecto del diseño, no un accidente.

> **Corrección (2026-07-27, después de implementar).** La proyección se quedó corta. Al correr
> `bt-calibrate.ts` con doble orden quedaron cacheados los dos órdenes de los **1.455 pares del
> schedule Swiss**, o sea la medición directa que acá faltaba: **31,8% ± 1,2pp**, no 21,2%.
>
> El error estuvo en la banda Δ<5, estimada con n=43 en 27,9%: el Swiss no reparte parejo dentro
> de esa banda, concentra en los pares aún más apretados, donde el modelo es aún menos capaz de
> distinguir. Y 31,8% es **piso**: el barrido samplea bandas 1-5 y producción usa 1-4, y las
> bandas anchas flipean menos.
>
> Uno de cada tres duelos lo decidía la posición. El argumento del cambio se refuerza.

## Lo que el sesgo de posición le hace hoy al ranking

`pairwise.ts:43` hashea los dos IDs concatenados (``djb2(`${a.id}|${b.id}`)``) para elegir el orden. Como `swissPairs`
devuelve siempre `[mejor, peor]` por provisional y el hash de los IDs no está correlacionado con la
fuerza, el hash **sí** logra que el sesgo no favorezca sistemáticamente a punteros ni a colistas.
Eso es real y vale.

Pero el comentario de `pairwise.ts:23` dice que el hash "cancela" el sesgo, y eso es falso en el
sentido que importa: lo convierte en **ruido por duelo**. El ruido atenúa — aplana las fuerzas BT y
vuelve aleatorios los reordenamientos específicos. Lo reparte; no lo detecta ni lo elimina.

Defecto adicional, no relacionado con LCES: **el hash de producción no incluye la ronda**
(`bt-pairwise.ts:234` sí la incluye). Los mismos dos alumnos emparejados en la ronda 3 y en la 5 se
presentan en el mismo orden siempre, así que el ruido de posición queda correlacionado entre
rondas en vez de promediarse a lo largo del juego. El doble orden lo vuelve irrelevante.

## Lo que los empates le hacen al Bradley-Terry

La escala **no puede** aplanarse: `recalibration.ts:77` pasa por `linearMatchMoments`, que reimpone
la media y la desviación de los provisionales pase lo que pase. Los empates no comprimen los
puntajes.

Lo que diluyen es el **poder de reordenar**. Con n=21 (la mediana de nuestras rondas) y B=4: 74
duelos frescos a peso 1, contra C(21,2)=210 pares de ancla × 0,35 = 73,5 de masa.

| | masa fresca decisiva | participación |
|---|---|---|
| Hoy (~0% empates) | 74 | 50,2% |
| Con 21% de empates | 58,5 | 44,3% |

Seis puntos. Pero **ese 21% ya era basura**: los reordenamientos que producía eran aleatorios. No
perdemos señal, sacamos ruido.

**Predicción falsable:** el `avgMove` de `bt-calibrate.ts` baja y su `stability` (split-half) sube.
Menos gente se mueve, pero los que se mueven se mueven de verdad. Si el drama queda corto, ese
mismo script dice cuánto subir B para recuperarlo comprando señal en vez de ruido.

## Tiempo y plata

La ronda mediana son **21 alumnos y 75 duelos** (`4n−10` con B=4). A concurrencia 10 y ~0,8 s por
llamada, el LLM tarda **~6 segundos**. El montaje del reveal necesita ~40 s (420 ms por duelo,
1.820 ms si es upset — `RecalibrationReveal.tsx:46-55`), y su línea 41 dice explícito que **espera**
al LLM cuando el LLM va atrás.

Hoy el LLM termina con ~34 s de holgura. Al doblar las llamadas, con ~28 s. **No se nota nada**, y
no hace falta tocar `RECAL_CONCURRENCY`. El timeout de la función son 300 s: sobra.

Costo: **+$0,18 por ronda**, ~$0,55 por juego.

O sea: el costo obvio de doblar los llamados no existe en ninguna de las dos monedas que importan.

## Los cambios

Tres commits, cada uno revertible por separado.

### Commit 1 — `functions/src/pairwise.ts`: los dos órdenes

Por cada par, dos llamadas **en paralelo** (`Promise.all`): `compare(a.response, b.response)` y
`compare(b.response, a.response)`. Se traduce cada veredicto al *id* del ganador. Si los dos
coinciden, ese gana; si se contradicen o alguno responde empate, empate (`winner: -1`).

Con `Promise.all` se mantienen ~10 duelos en vuelo (20 requests), así que el wall-clock no se mueve
de los ~6 s.

**Se borra `djb2`** (`pairwise.ts:15-19`) y el bloque de elección de orden (`:43-45`). Existían sólo
para elegir un orden; ahora corremos los dos. También se corrige el comentario de `:23` que afirma
que el hash cancela el sesgo.

**No cambia nada más de forma:** un `DuelResult` por par, `duelTotal` idéntico (`4n−10`), y `onDuel`
dispara **una vez por duelo**, no una por llamada. `index.ts` no se toca.

**Manejo de errores — decisión consciente:** el `compare` de `index.ts:921-937` atrapa cualquier
fallo y devuelve `'tie'`, así que un fallo de API ya se convierte hoy en empate. Con dos llamadas
hay el doble de chances de que una falle. Lo dejamos así: un fallo se vuelve empate, que es
conservador (no reordena a nadie con datos malos). Distinguir "falló" de "empataron" obligaría a
cambiar el tipo `Comparator` y a tocar `index.ts`; no vale la complejidad por un caso raro.

**Tests** (`functions/src/pairwise.test.ts`):

- **El test que importa:** un comparador que siempre responde `'A'` — puro sesgo de posición, sin
  mirar el texto. Hoy produce ganadores; con el cambio **debe producir puros empates**. Codifica
  exactamente la propiedad que estamos comprando. Ídem un comparador que siempre responde `'B'`.
- Un comparador que responde según contenido y es consistente al invertir → sigue produciendo
  ganadores decisivos.
- El comparador se invoca exactamente `2 × pares` veces, y `onDuel` exactamente `pares` veces.
- Los tres tests que ya existen deben pasar **sin tocarlos**: su comparador (`a < b ? 'A' : 'B'`)
  mira el contenido y es consistente al invertir. Si hay que editarlos, algo se rompió.

### Commit 2 — `src/pages/student/RecalibrationReveal.tsx`: dibujar el empate

Hoy el componente **no sabe** dibujar un empate. `:135` sólo pinta el cartel del ganador
(`verdict && winnerSide !== 'tie'`), y en `:113-120` cada panel recibe `win` o `lose` — si nadie
ganó, **los dos quedan en `lose`**. Un empate se ve como dos contendientes apagados, sin texto,
160 ms, y corta al siguiente.

Hoy no se nota porque el único empate posible es un error de API. Con el doble orden sería **1 de
cada 5 tarjetas**, en un proyector, frente al curso: parece que el juego se rompió.

El cambio: estado neutro para los dos paneles (ni `win` ni `lose`), un cartel de empate, y más
tiempo en pantalla que los 160 ms actuales para que no sea un parpadeo.

**Decisión de producto pendiente, con mockups a la vista antes de implementar:** un empate puede
leerse como *"ninguno de los dos convenció"* o como *"quedaron iguales, los dos bien"*. Cambia el
tono de lo que ve el curso. Se decide mostrando las dos versiones, no en el spec.

### Commit 3 — `RECAL_B` / `RECAL_W_ANCHOR`: sólo si hacen falta

`index.ts:815-816` dicen "(calibrated)", y se calibraron con una tasa de empate de ~0%. Correr
`bt-calibrate.ts` con la regla nueva y comparar el frontier drama-vs-estabilidad contra el actual
(B=4, w=0,35).

Su caché (`calib-*.jsonl`) ya tiene los órdenes forward pagados y su clave incluye la ronda, así
que reusa la mitad igual que hizo `bt-order-flip.ts`. Requiere agregarle el doble orden al script,
en paralelo al cambio de producción.

**Si el drama aguanta, este commit no existe y quedan dos.**

> **Resultado (2026-07-27): el drama aguantó, las constantes no se tocaron.** La predicción se
> cumplió en las 12 celdas del barrido, sin excepción: `stability` sube en todas, `avgMove` baja en
> 10 de 12 (sube sólo en las dos celdas w=0,1, que son las inestables de todos modos).
>
> | B=4 | avg\|Δrank\| | %moved | stability |
> |---|---|---|---|
> | w=0,50 | 2,047 → 1,900 | 0,788 → 0,791 | 0,957 → **0,969** |
> | w=0,25 | 3,044 → 3,015 | 0,847 → 0,850 | 0,884 → **0,915** |
>
> Producción usa `w_anchor = 0,35`, entre esas dos celdas. Interpolando: el drama queda igual
> (`%moved` plano) y la estabilidad sube 1-3pp. La celda w=0,25 cruza el umbral de 0,9 que el
> propio script declara como su vara.
>
> El patrón fino importa: **`%moved` plano con `avgMove` a la baja** significa que se mueve la
> misma gente pero salta menos lejos. Con la estabilidad al alza, la lectura es que sacamos los
> saltos largos aleatorios —las sorpresas que eran cara o sello— y conservamos el reordenamiento
> real. Un upset falso es peor que ningún upset.

## Verificación

Los tests cubren la lógica de `pairwise.ts`, pero la clase de bug que importa acá —el empate que se
dibuja como dos paneles apagados— pasa todos los tests. Antes de dar esto por bueno hay que
**jugarlo**: una partida de prueba con al menos una ronda ranked, mirando el reveal completo, y
leer los duelos escritos en `games/{code}/rounds/round_N/duels/` para confirmar que aparecen
`winner: 'tie'` en la proporción esperada.

## Por qué no RankNet

RankNet es una red chica que lee el **embedding del texto** y devuelve un número; se entrena con
pares etiquetados y aprende una función texto → puntaje. Bradley-Terry no lee nada: tiene un
parámetro libre por ítem y lo ajusta contra el registro de victorias.

Toda la ganancia del paper viene de su régimen, y es el opuesto al nuestro. 1.700 ensayos con 5.000
comparaciones son **~3 comparaciones por ítem**: la mayoría queda casi sin restringir y BT no tiene
con qué ubicarlos; RankNet los rescata **interpolando** desde el embedding. La figura 4, con M=50
sobre 1.700 ensayos, son **0,03 comparaciones por ítem** — ahí BT ni siquiera puede rankear al 95%
del conjunto. Que RankNet gane con 50-100 comparaciones es cierto pero no es nuestra situación.

Nosotros hacemos `(4n−10)×2/n ≈ 7 duelos por estudiante`. Cada ítem está densamente comparado, el
grafo es conexo por construcción y el BT queda completamente determinado. **No hay ítems huérfanos
que rescatar**, que es lo único que RankNet aporta.

Peor: acá haría daño.

- **Sobreajuste garantizado.** ~800k parámetros (3072×256) sobre 21 ítems y 74 etiquetas binarias,
  con hiperparámetros (dropout 0,3, batch 4096) calibrados para 5.000 pares sobre 1.700 ensayos.
- **Aprendería los atajos equivocados.** De embeddings de respuestas de alumnos sacaría longitud,
  tema y estilo — exactamente lo que no queremos premiar al corregir — y no hay conjunto de
  validación para pillarlo.
- **Rompe propiedades operativas.** Una llamada de embeddings por respuesta, un loop de
  entrenamiento dentro de una Cloud Function sin torch, e inicialización aleatoria metiendo
  no-determinismo en un ajuste que hoy es reproducible.

Descartado. Sí puede valer en el pipeline separado de corrección de pruebas escritas, por razones
que no aplican acá (ver `docs/evaluacion_llm_literatura.md`).
