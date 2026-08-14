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

/**
 * URL absoluta para entrar a un compas. Es OTRA que la del juego —el alumno
 * cae directo en `/compas/{code}`, sin pasar por `/join`— porque un compas no
 * tiene lobby: no hay nada que esperar salvo que el anfitrion muestre el primer
 * item, y una pantalla intermedia solo agrega un paso donde perder gente.
 */
export function buildCompasUrl(code: string, origin: string, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const limpio = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${origin.replace(/\/$/, '')}${base}compas/${limpio}`;
}

/** La misma URL, resuelta contra el entorno actual del navegador. */
export function currentCompasUrl(code: string): string {
  return buildCompasUrl(code, window.location.origin, import.meta.env.BASE_URL || '/');
}

/**
 * A donde iba el alumno antes de que lo mandaran a iniciar sesion.
 *
 * Existe porque todas las rutas rebotan a `/` cuando no hay sesion, y el
 * destino se perdia en el camino: quien escaneaba el QR del compas sin haber
 * entrado nunca a la app caia en la portada, sin el codigo y sin nada que le
 * dijera que habia pasado. En el telefono de un alumno —donde la sesion no esta
 * abierta casi nunca— ese era el caso normal, no el raro.
 *
 * Devuelve null para cualquier cosa que no sea una ruta interna. La lista de lo
 * que se rechaza no es paranoia de manual: `//evil.com` es un protocol-relative
 * URL que el navegador resuelve a otro dominio, y `/\evil.com` hace lo mismo en
 * varios navegadores. Un destino que llega por la barra de direcciones es texto
 * de cualquiera, y mandar a alguien a otro sitio despues de un login es
 * exactamente como se roba una sesion.
 */
export function destinoSeguro(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}
