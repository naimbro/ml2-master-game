/**
 * URL absoluta para entrar a un juego, la que codifica el QR de la sala.
 *
 * Tiene que ser absoluta porque va dentro de un QR: el telefono que lo escanea no
 * tiene contexto de origen. Y tiene que respetar BASE_URL porque el sitio se sirve
 * bajo /ml2-master-game/ en GitHub Pages — una URL sin ese prefijo da 404 solo en
 * produccion, que es el peor momento para descubrirlo.
 */
export function buildJoinUrl(gameCode: string, origin: string, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const code = gameCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${origin.replace(/\/$/, '')}${base}join?code=${code}`;
}

/** La misma URL, resuelta contra el entorno actual del navegador. */
export function currentJoinUrl(gameCode: string): string {
  return buildJoinUrl(gameCode, window.location.origin, import.meta.env.BASE_URL || '/');
}
