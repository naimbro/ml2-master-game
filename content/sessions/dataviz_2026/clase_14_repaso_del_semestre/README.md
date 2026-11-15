# Clase 14 — Repaso del semestre

Juego del lunes 16 de noviembre de 2026, **a las 11:30, después del recreo** de
la clase 14 («Community manager»). **Ocho rondas cortas, ~30 min de pared,
todas de código y todas de editar.** Nunca jugado con el curso.

## Cómo es: editar, no escribir de cero

Es la segunda versión, rehecha el 15-nov después de la corrida en seco (sala
`X9RSDK`). Naim la jugó en su teléfono y pidió tres cosas:

1. **Que no dependa del contexto de clases pasadas.** La primera versión
   preguntaba «en la clase 3 salieron 10 categorías, ¿por qué?», y el profesor
   no reconoció la referencia. El juego mide **conceptos que les sirven
   después**, no el recuerdo de una tabla de agosto.
2. **Que escribir código en el teléfono no sea un infierno** («`%>%` es un
   infierno»). Cada ronda trae el código **ya escrito en el cuadro**
   (`codigoInicial`, campo nuevo del escenario) y pide **una edición chica**.
   En ninguna ronda hay que teclear un `%>%`.
3. **Fuera las alternativas: todas de código.** Y los jueces tienen que poder
   juzgar **sin que R haya corrido**: cada `judgeFocus` trae el código inicial
   y la edición esperada, y un cuadro devuelto sin editar vale 0-20.

## Las rondas

| # | Ronda | Concepto (clase) | La edición | Reloj |
|---|---|---|---|---|
| 1 | Ver la tabla | mirar los datos (2–3) | escribir `curso` bajo el comentario | 75 s |
| 2 | Contar | `count()` (3) | `transporte` → `sistema_operativo` | 75 s |
| 3 | Filtrar | operadores (4) | `== "Metro"` → `!= "Auto"` | 75 s |
| 4 | El filtro que miente | texto que parece número (4–5) | una línea `mutate(... as.numeric(...)) %>%` | 120 s |
| 5 | El promedio que no sale | `NA` en un promedio (6–7) | `na.rm = TRUE` dentro de `mean()` | 90 s |
| 6 | El gráfico que no corre | las piezas de ggplot (8) | `%>%` → `+` | 75 s |
| 7 | Una línea por problema | la tercera variable (10) | `color = problema` dentro de `aes()` | 120 s |
| 8 | El número en la barra | `geom_text()` (14) | una capa `+ geom_text(aes(label = ...))` | 120 s |

Naim eligió R6 (el `%>%`), R7 (color, no facetas), R8 (el número, no ordenar ni
la referencia) y ocho rondas, no nueve.

**Presupuesto:** 750 s de relojes (12,5 min) + ~2 min de overhead por ronda
abierta (jueces, revelación, leaderboard) = **~28,5 min**. El overhead es lo que
limita: con nueve rondas se pasaba de 30.

## La app: lo que se agregó para esta sesión

- **`codigoInicial`** (`src/types/game.ts`): `Round.tsx` lo deja escrito en el
  cuadro al empezar cada ronda de código, una sola vez por ronda. La telemetría
  de escritura lo registra como largo de partida (`RegistroEscritura.textoInicial`),
  no como tecleado ni como pegado. El validador rechaza un `codigoInicial` en una
  ronda que no es de código.
- **R se reintenta solo** si la carga cayó (`MotorR.reintentarSiFallo`): al
  volver a la pestaña y al empezar cada ronda de código. Salió de la corrida en
  seco: en el juego apareció «R no cargó», y la página de la ronda nunca volvía a
  intentar. El aviso ahora muestra el **motivo** del fallo.
- `/preview-probar` muestra el código inicial de cada ronda.

## El lobby

**Abrir la sala a las 11:20, en el corte**: R se baja durante el recreo. Si un
teléfono se apagó y la carga cayó, ahora se reintenta solo al volver.

**Lo que desplaza:** de 11:30 a 12:00 iban la prueba del scroll y la mitad de
«qué lámina perdió a la sala». Esa decisión es de Naim, no del juego.

## Pendiente conocido

- **Ventana de incógnito con una segunda cuenta en el mismo teléfono:** R no
  cargó (15-nov). Lo más probable es la memoria de dos R a la vez en un teléfono.
  Naim decidió dejarlo para después: los alumnos juegan en su Chrome normal.
- Sin probar: iPhone y un Android viejo.

## Después de jugar

```bash
npm run diagnostico <CODIGO>
node scripts/judge-levels.cjs
```

**La telemetría de cada ronda de código guarda un campo `r`**
(`telemetria/{uid}_{ronda}.r`): `pruebas`, `errores`, `ultimaOk`, `estado`
(cómo estaba R en ese teléfono al enviar: `listo`, `cargando`, `fallo`) y
`msCarga`. Es el dato que dice **en cuántos teléfonos falló R**, y lo tiene que
leer `diagnostico-de-clase`. Mirar también si los que no tuvieron R sacaron
menos que los que sí.
