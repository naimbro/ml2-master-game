# Demo docente UAI — martes 28 de julio 2026

Branch: `feat/mc-media-mundial` · Merge a `main` el **lunes por la mañana** (deja un día
de margen; el deploy del frontend lo hace GitHub Actions al hacer push).

**No hay cambios en Cloud Functions ni en Firestore rules.** Rollback = `git revert` + push (~2 min).

---

## A. Verificado automáticamente (ya está hecho)

| Chequeo | Estado |
|---|---|
| `npm test` | 143/143 (20 nuevos, de scoring MC) |
| `npx tsc -b` | limpio |
| `npm run lint` | 0 errores nuevos en archivos tocados |
| `node scripts/validate-content.cjs` | 0 errores en todos los packs |
| `npm run build` + `vite preview` | los 6 assets responden 200 bajo `/ml2-master-game/media/mundial/` |
| Ruta ingenua `/media/...` | 404 — confirma que la resolución vía BASE_URL es la correcta |

---

## B. Falta verificar a mano (yo no puedo: requiere navegador + login Google)

Esto es lo único que queda antes de estar seguro. **Hazlo el domingo o lunes temprano**,
no el martes.

### B1. Ensayo completo de `Mundial 2026: La Final` (~15 min)

`npm run dev` → `/professor` → curso **Mundial 2026** → *La Final* → Crear juego.
Abre el código desde **un segundo perfil de Chrome y desde tu teléfono**.

Ronda por ronda, confirma:

- [ ] **R1** — La pantalla de inicio del bloque aparece **antes** de cualquier reloj.
      El audio del himno se reproduce al tocar play (no solo). El contador
      "Empieza solo en Ns" baja de 12 a 0 y arranca solo si no tocas nada.
- [ ] **R1** — Al responder, el puntaje mostrado cuadra con la fórmula:
      instantáneo ≈ 100, justo en la chicharra = 70, incorrecta = 20, sin responder = 0.
- [ ] **R2** — La bandera de Cabo Verde se ve en la pregunta 1 (SVG).
- [ ] **R2** — Al terminar el bloque: **no aparece el overlay de duelos** ni se
      repite la animación del leaderboard. Debe resolverse rápido.
- [ ] **R3 / R4** — Salen las 3 tarjetas de jueces con feedback. La recalibración
      pairwise (duelos) **sí** debe correr acá — es el momento dramático.
- [ ] **R4** — El diagrama táctico SVG se ve legible en el proyector.
- [ ] **R5** — Las 3 fotos (Pelé / Maradona / Messi) se ven lado a lado en laptop
      y apiladas en teléfono. Los créditos aparecen bajo cada foto.
- [ ] **R5** — Al terminar salta **directo al podio** (es la última ronda).
- [ ] Cronometra cada ronda y anota el total.

### B2. Ensayo del respaldo `Solo Kahoot` (~7 min)
- [ ] Se juega entero sin que se invoque ningún juez.

### B3. Segmento de autoría en vivo
- [ ] Crear curso → *Nueva sesión con asistente IA* (~1 min de generación).
- [ ] En el editor: añadir una ronda → cambiar a **Opción múltiple** → escribir
      pregunta y 3 alternativas → marcar la correcta → pegar una URL de imagen →
      **Vista previa** → Publicar.
- [ ] **Confirma que los inputs NO pierden el foco al escribir** (era un bug real
      que corregí; si reaparece, avísame).
- [ ] Reordenar rondas con ↑/↓ y guardar; volver a abrir y confirmar el orden.

### B4. Robustez
- [ ] **Móvil a 375 px**: sin scroll horizontal en ronda, resultados y podio.
- [ ] **iPhone Safari**: el mp3 del himno suena (por esto no usamos .ogg).
- [ ] **Recarga a mitad de bloque MC**: debe mostrar "Bloque completado", nunca
      volver a mostrar las preguntas.
- [ ] **Media rota**: cambia temporalmente un `src` a algo inexistente → debe
      aparecer el texto alternativo en un recuadro y la ronda seguir jugable.
- [ ] **Compatibilidad**: juega una ronda Kahoot de `session_4_rag_applied` (ML II)
      y una ronda abierta de cualquier sesión vieja.
- [ ] **Refrescar la pestaña del host** a mitad de ronda y en resultados → debe
      recuperarse sola por el enrutamiento según `status`.

### B5. Personalizar los jueces (sin código, 2 min — y demuestra una función)
`/professor/courses/mundial_2026/judges` → renombra los tres jueces al tema:
🎯 *La DT* · 🎙️ *El Relator* · 📊 *El Data Scout*.

---

## C. El martes: tarjeta de operación

**Antes de empezar**
- [ ] Desactivar suspensión de pantalla del notebook.
- [ ] Cerrar las demás pestañas; dejar la del juego en primer plano.
- [ ] Código del juego anotado en papel y en una diapositiva.
- [ ] Tener abierta la sesión de respaldo *Solo Kahoot* por si acaso.

**Riesgo #1 — tu pestaña ES el motor del juego.** Todas las transiciones de estado,
`processRoundEnd` y la recalibración corren desde el navegador del host. Si tu
pestaña se suspende o se cierra, **el juego se congela para todos**. Si pasa:
vuelve a abrir la misma URL — el enrutamiento por `status` te devuelve a la pantalla
correcta.

**Si los jueces se demoran** (R3/R4): tienes el botón rojo *Terminar Ronda*. Pide que
envíen temprano; las respuestas se evalúan a medida que llegan, no al final.

**Si la IA está caída del todo**: lanza *Mundial 2026 → Solo Kahoot*. Son 5 bloques de
opción múltiple, cero dependencia de LLM. Salta el segmento de autoría en vivo (usa el
generador de sesiones, que también depende de OpenAI).

**Si el WiFi del recinto tiene portal cautivo**: pide que usen datos móviles.
Cualquier cuenta de Google puede entrar (no hay restricción de dominio).

---

## D. Lo que quedó fuera (P1, no bloquea el martes)

1. **Pasada visual** (responsive de `Results.tsx`, legibilidad de proyector, pulido del
   feedback MC). Deliberadamente pospuesta: rediseñar la pantalla más coreografiada
   del sistema el día antes de la demo es el peor cambio riesgo/beneficio disponible.
2. **Botón "crear sesión en blanco"** — hoy la única vía para crear una sesión en un
   curso dinámico es el generador con IA. Sería un seguro barato para B3.
3. **Guía en Google Slides** para profesores. La infraestructura ya existe en
   `naimbro.github.io` (service account + `slide_template.py`). Debe hacerse **después**
   de congelar la interfaz, con capturas reales.

## E. Decisión de scoring, en una línea para la audiencia

> Todo se puntúa de 0 a 100. En opción múltiple: correcta 70-100 según rapidez,
> incorrecta 20, sin responder 0. En las preguntas abiertas, tres jueces IA eligen
> uno de seis niveles escritos por dimensión. El ranking promedia las rondas.
> Así ni la velocidad ni un tipo de pregunta se comen el juego.
