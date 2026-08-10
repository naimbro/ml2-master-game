/**
 * El recuento de respuestas de una pregunta de alternativas — lo que dibuja el
 * grafico de aciertos de la revelacion.
 *
 * Existe porque los datos crudos NO son publicos. Cada eleccion se guarda en
 * `games/{code}/choices`, que solo puede leer el anfitrion: publicarlas mientras
 * la pregunta corre seria repartir la respuesta correcta. El anfitrion las
 * agrega aca y publica el resultado en el doc del juego cuando la pregunta
 * cierra, que es cuando la respuesta correcta ya es de todos.
 *
 * Funciones puras: no tocan Firestore.
 */

/** El recuento de UNA pregunta, tal como viaja en `game.mcStats`. */
export interface MCQuestionStats {
  /** Cuantos jugadores contestaron. No es el total del curso. */
  total: number;
  /** Cuantos eligieron cada alternativa, por id de opcion ('A', 'B', ...). */
  byOption: Record<string, number>;
}

/**
 * La clave dentro de `game.mcStats`. Lleva la ronda adentro porque un juego
 * tiene varios bloques de alternativas y todos empiezan a contar desde la
 * pregunta 0.
 */
export function mcStatsKey(round: number, questionIndex: number): string {
  return `r${round}q${questionIndex}`;
}

/** Un doc de `games/{code}/choices`, ya leido. */
export interface ChoiceInput {
  playerId: string;
  optionId: string;
}

/**
 * Cuenta cuantos eligieron cada alternativa.
 *
 * - Deduplica por jugador: el doc se escribe con `setDoc` sobre un id fijo, asi
 *   que un reintento lo reescribe, pero dos lecturas del mismo snapshot no
 *   pueden contar dos veces a la misma persona.
 * - Descarta a quien no este en `playerIds`. El profesor que dirige sin jugar
 *   no aparece en `players`, y su click no puede mover el grafico del curso.
 * - Toda opcion existente arranca en 0, para que el grafico dibuje las cuatro
 *   barras aunque nadie haya marcado una.
 */
export function aggregateChoices(
  choices: ChoiceInput[],
  optionIds: string[],
  playerIds: Set<string>,
): MCQuestionStats {
  const byPlayer = new Map<string, string>();
  for (const c of choices) {
    if (!c?.playerId || typeof c.optionId !== 'string') continue;
    if (!playerIds.has(c.playerId)) continue;
    byPlayer.set(c.playerId, c.optionId);
  }

  const byOption: Record<string, number> = {};
  for (const id of optionIds) byOption[id] = 0;
  let total = 0;
  for (const optionId of byPlayer.values()) {
    // Una opcion que no esta en la pregunta se ignora en el desglose pero SI
    // cuenta como respuesta: es un dato viejo o corrupto, no una no-respuesta.
    if (optionId in byOption) byOption[optionId] += 1;
    total += 1;
  }

  return { total, byOption };
}
