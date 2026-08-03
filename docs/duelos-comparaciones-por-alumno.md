# ¿Cuántas comparaciones por alumno necesitan los duelos?

Medición del 3 de agosto de 2026, con `scripts/bt-comparisons-per-student.ts`.
Corre solo contra el caché (`scripts/.cache/calib-*.jsonl`) y Firestore: **no llama
a ninguna API y no cuesta nada** volver a correrlo.

## La pregunta

No es "cuántos duelos en total". El schedule Swiss ya es lineal en el número de
alumnos:

```
pares(n, B) = B·n − B(B+1)/2
comparaciones por alumno = 2·pares/n = 2B − B(B+1)/n  →  ≈ 2B
```

Con 33 alumnos y `B = 4`: **118 pares, 236 llamadas, 7,4 comparaciones por
alumno**. Las comparaciones por alumno son casi constantes en `n`, así que subir
o bajar `B` es la única decisión y el total de duelos es su consecuencia.

La teoría de Bradley-Terry (Negahban–Oh–Shah 2012; Hajek–Oh–Xu 2014) pide
Θ(log n) comparaciones por ítem para recuperar un orden completo desde cero, y en
la práctica 10-15. Pero nosotros no partimos de cero: `w_anchor = 0,35` mete
pseudo-votos sobre *todos* los pares, así que los duelos solo tienen que mover
gente dentro de ±B posiciones. Cuánto alcanza con ese ancla es empírico.

## Los datos

16 rondas abiertas de 6 juegos canónicos, 19-26 alumnos por ronda, **1.455 pares
con veredicto real de gpt-4o en los dos órdenes, 100 % de cobertura del caché**.

| banda | comp/alumno | decisivas | empates | estab. split-half | ρ vs referencia | se mueve | \|Δpos\| |
|---|---|---|---|---|---|---|---|
| B=1 | 1,9 | 1,2 | 35 % | 0,969 | 0,931 | 75 % | 1,32 |
| B=2 | 3,7 | 2,4 | 35 % | 0,961 | 0,961 | 80 % | 1,84 |
| B=3 | 5,4 | 3,6 | 34 % | 0,945 | 0,980 | 83 % | 2,22 |
| **B=4** | **7,0** | **4,7** | **33 %** | **0,952** | **0,989** | **83 %** | **2,33** |
| B=5 | 8,6 | 5,8 | 32 % | 0,943 | 1,000 | 86 % | 2,49 |

`ρ vs referencia` = correlación de Spearman contra el ajuste que usa todo el pool
(B=5). Es la curva de convergencia.

## Qué dice

**B=4 es el número correcto.** Los incrementos de ρ contra la referencia son
+0,030 (B=1→2), +0,019 (2→3), +0,009 (3→4). El retorno cae bajo 0,01 justo en
B=4: de ahí en adelante más comparaciones ya no cambian el orden, solo cuestan.

**Bajar B sería un error caro en lo que importa.** B=2 ahorra la mitad de las
llamadas (US$0,27 por ronda con 33 alumnos en vez de US$0,54) pero baja el
acuerdo a 0,961 y, sobre todo, deja **2,4 comparaciones decisivas por alumno**.
Un reordenamiento apoyado en dos comparaciones por persona no se puede defender
delante del curso.

**El empate es el impuesto real.** Un tercio de los duelos no decide, porque el
doble orden (regla LCES) manda a empate todo par donde el veredicto se da vuelta
al invertir la presentación. Con B=4 las 7,0 comparaciones por alumno son 4,7
decisivas. Ese es el número honesto, y es el que hay que cuidar.

**Con 33 alumnos estamos un poco mejor que en esta medición.** Los juegos del
caché tienen n≈21 y dan 7,0 comparaciones por alumno; a n=33 la fórmula da 7,4,
porque el término `B(B+1)/n` se achica.

## Una advertencia sobre la columna split-half

Casi no se mueve (0,94-0,97) y encima *baja* al subir B. No es una paradoja: las
dos mitades comparten el ancla completa, así que en cada mitad el ancla pesa el
doble respecto de los duelos. Esa columna mide cuánto domina el ancla, no la
precisión del ajuste. **La columna que hay que leer es `ρ vs referencia`.**

## Lo que NO se toca

El presupuesto de 30 s del montaje (`src/lib/duelMontage.ts`) no sale de correr
menos duelos. Se corren los 118 y los 118 alimentan el ajuste; lo que se acota es
cuántos se *muestran*. Ver ese archivo.

## Si algún día hay que bajar el costo

La palanca no es B, es el modelo del duelo. `scripts/cost-model.ts`: gpt-4o
cuesta US$0,00220 por llamada y gpt-5-mini US$0,00024, nueve veces menos. Antes
de cambiarlo hay que medir si el veredicto aguanta — `scripts/bt-order-flip.ts`
mide exactamente eso.
