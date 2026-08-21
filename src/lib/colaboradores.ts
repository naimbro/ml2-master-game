/**
 * Colaboradores de un curso: los mails que pueden entrar a un curso ajeno.
 *
 * El modelo de propiedad de la plataforma era un solo campo — `professorId`, el
 * uid del profesor que creo el curso. Con eso, un ayudante que quiere llevar el
 * registro de un curso no tiene ninguna forma de entrar: no existe la nocion de
 * "mas de una persona en el mismo curso".
 *
 * La lista se guarda con MAILS y no con uid a proposito. Un uid solo existe
 * despues del primer login, asi que agregar por uid obligaria al profesor a
 * pedirle a su ayudante que entre primero, averiguar su uid —que no se muestra
 * en ninguna pantalla— y recien ahi agregarlo. Con el mail se agrega antes de
 * que el ayudante haya abierto la plataforma, y el dia que entra ya lo espera
 * el curso.
 *
 * El costo de esa decision es que el mail hay que normalizarlo en TODAS las
 * puntas, porque la comparacion en las reglas de Firestore es literal: un
 * "Juan.Perez@Gmail.com " guardado con mayusculas y un espacio al final no
 * calza nunca con el `request.auth.token.email` de Google, y el ayudante ve un
 * "permiso denegado" que nadie puede explicar. Por eso todo pasa por
 * `normalizarMail` antes de guardarse, y las reglas comparan contra
 * `.lower()`.
 *
 * Lo que este archivo NO decide es que puede hacer un colaborador. Eso vive en
 * `firestore.rules`, y hoy la respuesta es: exactamente lo mismo que el dueno,
 * incluido borrar el curso. La unica cosa reservada al dueno es no perder el
 * curso: `professorId` es inmutable despues de crearse.
 */

/**
 * Tope de la lista. No lo imponen las reglas — es una barrera de cordura en la
 * pantalla, para que nadie pegue la nomina completa de un curso en un campo que
 * entrega poder total sobre el.
 */
export const MAX_COLABORADORES = 5;

export type ErrorColaborador =
  | 'vacio'
  | 'invalido'
  | 'repetido'
  | 'es-el-dueno'
  | 'demasiados';

/** Minusculas y sin espacios: es la forma en que se guarda y se compara. */
export function normalizarMail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Validacion deliberadamente floja: algo@algo.algo, sin espacios.
 *
 * Un regex estricto de RFC 5322 rechaza mails reales y no aporta nada aca: el
 * mail no se usa para mandar nada, solo para compararlo contra el que trae la
 * sesion de Google. Si esta mal escrito, el colaborador simplemente no entra —
 * lo que se quiere atajar es el dedazo obvio, no validar el dominio.
 */
export function esMailValido(mail: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
}

/**
 * Lee la lista desde un documento de Firestore.
 *
 * Sale de un campo que escribe otra persona, asi que se valida la forma antes
 * de que llegue al render: si alguien dejo ahi un string suelto o un numero, se
 * ignora en vez de romper la pantalla del curso.
 */
export function leerColaboradores(campo: unknown): string[] {
  if (!Array.isArray(campo)) return [];
  return campo
    .filter((m): m is string => typeof m === 'string')
    .map(normalizarMail)
    .filter((m) => m.length > 0);
}

export type ResultadoAgregar =
  | { ok: true; lista: string[] }
  | { ok: false; error: ErrorColaborador };

/**
 * Agrega un mail a la lista, o dice por que no.
 *
 * `mailDelDueno` se pasa para poder rechazar el caso de un profesor
 * agregandose a si mismo: no falla, pero deja en la pantalla un colaborador que
 * no sirve para nada y hace dudar de si el permiso viene de ahi.
 */
export function agregarColaborador(
  lista: string[],
  raw: string,
  mailDelDueno: string | null | undefined,
): ResultadoAgregar {
  const mail = normalizarMail(raw);
  if (!mail) return { ok: false, error: 'vacio' };
  if (!esMailValido(mail)) return { ok: false, error: 'invalido' };
  if (mailDelDueno && mail === normalizarMail(mailDelDueno)) {
    return { ok: false, error: 'es-el-dueno' };
  }
  if (lista.some((m) => normalizarMail(m) === mail)) {
    return { ok: false, error: 'repetido' };
  }
  if (lista.length >= MAX_COLABORADORES) return { ok: false, error: 'demasiados' };
  return { ok: true, lista: [...lista, mail] };
}

export function quitarColaborador(lista: string[], mail: string): string[] {
  const objetivo = normalizarMail(mail);
  return lista.filter((m) => normalizarMail(m) !== objetivo);
}

export function mensajeError(error: ErrorColaborador): string {
  switch (error) {
    case 'vacio': return 'Escribe un correo.';
    case 'invalido': return 'Ese correo no parece un correo.';
    case 'repetido': return 'Ese correo ya está en la lista.';
    case 'es-el-dueno': return 'Ese es tu propio correo: el curso ya es tuyo.';
    case 'demasiados': return `No se pueden agregar más de ${MAX_COLABORADORES} colaboradores.`;
  }
}

/**
 * Si esta persona puede entrar al curso.
 *
 * Espejo en TypeScript de lo que dicen las reglas, para que la pantalla no
 * ofrezca botones que Firestore va a rechazar. NO es la seguridad: la seguridad
 * son las reglas. Si los dos se separan, manda `firestore.rules`.
 */
export function puedeEditarCurso(
  curso: { professorId?: string; colaboradores?: unknown },
  usuario: { uid: string; email: string | null } | null,
): boolean {
  if (!usuario) return false;
  if (curso.professorId && curso.professorId === usuario.uid) return true;
  if (!usuario.email) return false;
  return leerColaboradores(curso.colaboradores).includes(normalizarMail(usuario.email));
}
