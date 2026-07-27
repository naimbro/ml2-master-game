/**
 * Fuente única: `functions/src/lib/bradley-terry.ts`.
 *
 * Esto era una copia. Cuando la de functions se refactorizó (se extrajo `runMM` y
 * se agregó `fitBradleyTerryFromWins` para el Bradley-Terry anclado de la
 * recalibración), la copia no se actualizó, y `bt-calibrate.ts` y `bt-pairwise.ts`
 * quedaron sin poder ni siquiera importar. Un reenvío no se puede desincronizar.
 *
 * El módulo de functions no importa nada, así que cruzar el límite sale gratis.
 */
export * from '../../functions/src/lib/bradley-terry';
