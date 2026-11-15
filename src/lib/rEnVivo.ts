import { resolveMediaSrc } from './media';

/**
 * R EN VIVO — ejecutar el código del alumno en su propio navegador.
 *
 * Las rondas de `answerFormat: 'code'` piden ggplot2 y hasta noviembre de 2026
 * nadie lo ejecutaba: los jueces lo «corrían de cabeza». Esto le da al alumno un
 * botón «Probar» que dibuja el gráfico o muestra el error de R ANTES de enviar.
 *
 * Corre con webR (R compilado a WebAssembly) dentro del teléfono de cada uno:
 * no hay servidor, y el código de un alumno no sale de su pestaña.
 *
 * LA REGLA QUE NO SE NEGOCIA: enviar nunca depende de esto. Si R no carga, si
 * el teléfono se queda sin memoria o si el wifi de la sala no da, el alumno
 * envía igual que siempre. Por eso este módulo jamás lanza: todo fallo termina
 * en un estado (`'fallo'`) o en un resultado (`ok: false`), y nada de acá
 * toca el camino de `submitAnswer`.
 *
 * Y lo que NO hace: no le avisa nada a los jueces. Un «corrió bien» reportado
 * por el cliente es falsificable, y pasárselo al panel cambia una calibración
 * que nadie midió.
 */

/** Versión fija a propósito: `latest` cambiaría el R de la sala sin avisar. */
export const VERSION_WEBR = 'v0.6.1';
// Tipada como `string` y no como literal: con el literal, TypeScript intenta
// resolver el módulo y falla el build por un archivo que vive en un CDN.
const URL_WEBR: string = `https://webr.r-wasm.org/${VERSION_WEBR}/webr.mjs`;

/** Donde R busca los archivos: su directorio de trabajo por defecto en webR. */
const DIRECTORIO_R = '/home/web_user';

export const TIMEOUT_EJECUCION_MS = 15_000;
export const TIMEOUT_CARGA_MS = 120_000;

const LINEAS_MAXIMAS = 40;

/** Un archivo que se copia al disco de R. `src` relativo a `public/`, como `MediaAsset.src`. */
export interface ArchivoR {
  name: string;
  src: string;
}

/**
 * El bloque `rEnVivo` de `config.json`. Es lo que hace verdad la frase «la
 * tabla `curso` ya está cargada» que traen los enunciados.
 */
export interface ConfigR {
  /** Paquetes que se instalan y se cargan con `library()`. */
  packages: string[];
  files?: ArchivoR[];
  /** Código R que deja las tablas listas. Corre una vez, con los paquetes ya cargados. */
  setup?: string;
}

export type EstadoMotor = 'inactivo' | 'cargando' | 'listo' | 'fallo';

export interface ResultadoR {
  ok: boolean;
  /** Lo que R imprimió, o el mensaje de error. Puede venir vacío si sólo dibujó. */
  texto: string;
  /** El último gráfico. Quien lo recibe lo dibuja y le llama `close()`. */
  imagen: ImageBitmap | null;
  ms: number;
  /** true cuando no fue un error de R sino que se pasó del tiempo. */
  cortado?: boolean;
}

// ---------------------------------------------------------------------------
// Lo que no necesita R
// ---------------------------------------------------------------------------

/**
 * Lo que el teclado del teléfono le hace al código y R no perdona. Se aplica
 * SÓLO a lo que se ejecuta: la respuesta que se envía queda como se escribió,
 * porque eso es lo que leen los jueces y lo que la telemetría midió.
 *
 * No convierte nada más a propósito. Arreglar mayúsculas o paréntesis sería
 * corregirle el ejercicio.
 */
// Las clases se arman por código y no como literales: un espacio duro o un
// carácter de ancho cero escritos tal cual en el archivo no se ven en ningún
// editor, y el próximo que toque esta función los borraría sin saberlo.
const claseDe = (...codigos: number[]) => new RegExp(`[${String.fromCharCode(...codigos)}]`, 'g');
const COMILLAS_DOBLES = claseDe(0x201c, 0x201d, 0x201e, 0x201f);
const COMILLAS_SIMPLES = claseDe(0x2018, 0x2019, 0x201a, 0x201b);
const ESPACIOS_DUROS = claseDe(0x00a0, 0x202f);
const ANCHO_CERO = claseDe(0x200b, 0x200c, 0x200d, 0xfeff);

export function normalizarCodigo(codigo: string): string {
  return codigo
    .replace(COMILLAS_DOBLES, '"')
    .replace(COMILLAS_SIMPLES, "'")
    .replace(ESPACIOS_DUROS, ' ')
    .replace(ANCHO_CERO, '');
}

export function limpiarError(mensaje: string): string {
  const limpio = mensaje.replace(/^Error in unknown source:\s*/, '').trim();
  return limpio || 'R devolvió un error sin mensaje.';
}

/** Una tabla de 33 filas impresa entera empuja el botón de enviar fuera de la pantalla. */
export function recortarSalida(texto: string, maxLineas: number = LINEAS_MAXIMAS): string {
  const lineas = texto.split('\n');
  if (lineas.length <= maxLineas) return texto;
  return [...lineas.slice(0, maxLineas), `… (${lineas.length - maxLineas} líneas más)`].join('\n');
}

/**
 * El `rEnVivo` de un juego, o `null` si ese juego no lleva botón «Probar».
 *
 * Mira la forma y no confía en el tipo: el bloque viene de la copia de
 * `sessionConfig` que cada juego guarda en Firestore, y una sesión creada desde
 * el editor puede traer cualquier cosa ahí. Un bloque mal formado tiene que
 * dar «sin botón», no una pantalla de ronda rota.
 *
 * Y devuelve `null` si ninguna ronda es de código: no vale la pena bajar R en
 * 27 teléfonos para un juego que no lo va a usar.
 */
export function configRDe(
  sessionConfig: { rEnVivo?: unknown } | null | undefined,
  scenarios: readonly { answerFormat?: string }[] | null | undefined,
): ConfigR | null {
  const r = sessionConfig?.rEnVivo as Partial<ConfigR> | null | undefined;
  if (!r || typeof r !== 'object') return null;
  if (!Array.isArray(r.packages) || !r.packages.every((p) => typeof p === 'string' && /^[A-Za-z][A-Za-z0-9.]*$/.test(p))) return null;
  if (r.files !== undefined && !(Array.isArray(r.files)
    && r.files.every((f) => f && typeof f.name === 'string' && typeof f.src === 'string'))) return null;
  if (r.setup !== undefined && typeof r.setup !== 'string') return null;
  if (!scenarios?.some((sc) => sc?.answerFormat === 'code')) return null;
  return { packages: r.packages, files: r.files, setup: r.setup };
}

export function claveDe(config: ConfigR): string {
  return JSON.stringify([config.packages, (config.files ?? []).map((f) => [f.name, f.src]), config.setup ?? '']);
}

/**
 * Cuánto se usó el botón en una ronda. Va a la telemetría que ya existe: es
 * descriptivo, no puntúa, y es el único dato que va a decir si R cargó en los
 * teléfonos de la sala.
 */
export interface ContadorPruebas {
  pruebas: number;
  errores: number;
  ultimaOk: boolean | null;
}

export function contadorVacio(): ContadorPruebas {
  return { pruebas: 0, errores: 0, ultimaOk: null };
}

export function anotarPrueba(c: ContadorPruebas, ok: boolean): ContadorPruebas {
  return { pruebas: c.pruebas + 1, errores: c.errores + (ok ? 0 : 1), ultimaOk: ok };
}

/** Lo que queda en `telemetria/{uid}_{ronda}.r`. Sin `undefined`: Firestore los rechaza. */
export interface TelemetriaR extends ContadorPruebas {
  /** Cómo estaba R en ese teléfono al momento de enviar. */
  estado: EstadoMotor;
  msCarga: number | null;
}

export function telemetriaR(
  contador: ContadorPruebas,
  motor: { estado: EstadoMotor; msCarga: number | null },
): TelemetriaR {
  return { ...contador, estado: motor.estado, msCarga: motor.msCarga };
}

// ---------------------------------------------------------------------------
// El pedazo de webR que se usa
// ---------------------------------------------------------------------------

interface SalidaWebR {
  type: string;
  data: unknown;
}

interface RefugioWebR {
  captureR(codigo: string, opciones: object): Promise<{ output: SalidaWebR[]; images: ImageBitmap[] }>;
  purge(): Promise<void>;
}

interface WebRLike {
  init(): Promise<unknown>;
  installPackages(paquetes: string[], opciones?: object): Promise<unknown>;
  evalRVoid(codigo: string): Promise<unknown>;
  FS: { writeFile(ruta: string, datos: Uint8Array): Promise<unknown> };
  objs: { globalEnv: { bind(nombre: string, valor: unknown): Promise<unknown> } };
  Shelter: new () => Promise<RefugioWebR>;
  close(): void;
}

export interface ModuloWebR {
  WebR: new (opciones: object) => WebRLike;
  ChannelType: { PostMessage: unknown };
}

/**
 * El código del alumno no se le pasa directo a `captureR`. Así el error llega
 * cortado en su primera línea («Problem while computing aesthetics») y se pierde
 * justo la que sirve («object 'Transporte' not found»): `cnd_message` con
 * `inherit = TRUE` trae la cadena entera. El `parse()` va ADENTRO del
 * `tryCatch` para que un paréntesis sin cerrar también salga como mensaje. Y
 * cada corrida va en un entorno nuevo, para que un `curso <- 5` del alumno no
 * le rompa la tabla en el intento siguiente.
 */
const ENVOLTORIO = `
tryCatch(
  withAutoprint(parse(text = .codigo), evaluated = TRUE, echo = FALSE, local = new.env(parent = globalenv())),
  error = function(e) stop(
    if (requireNamespace("rlang", quietly = TRUE)) rlang::cnd_message(e, inherit = TRUE, prefix = TRUE) else conditionMessage(e),
    call. = FALSE
  )
)`;

const OPCIONES_CAPTURA = {
  withAutoprint: false,
  captureStreams: true,
  // En `false` el error de R NO se relanza: llega como una línea más de stderr
  // y el código roto parece haber corrido. Medido el 14-nov-2026.
  captureConditions: true,
  // El dispositivo dibuja al doble: sale un bitmap de 840x640.
  captureGraphics: { width: 420, height: 320 },
};

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** `warning()` y `message()` llegan como objetos de R, no como texto. */
async function textoDeCondicion(o: SalidaWebR): Promise<string | null> {
  try {
    const condicion = o.data as { get(campo: string): Promise<{ toArray(): Promise<unknown[]> }> };
    const [primero] = await (await condicion.get('message')).toArray();
    const msj = String(primero ?? '').trimEnd();
    if (!msj) return null;
    return o.type === 'warning' ? `Warning: ${msj}` : msj;
  } catch {
    return null;
  }
}

interface Dependencias {
  cargar: () => Promise<ModuloWebR>;
  traer: (src: string) => Promise<Uint8Array>;
}

export class MotorR {
  estado: EstadoMotor = 'inactivo';
  /** Por qué quedó en `'fallo'`. */
  error: string | null = null;
  /** Cuánto tardó la última carga completa, para la telemetría. */
  msCarga: number | null = null;

  private readonly deps: Dependencias;
  private webR: WebRLike | null = null;
  private config: ConfigR | null = null;
  private clave: string | null = null;
  private preparando: Promise<void> | null = null;
  private generacion = 0;
  private cola: Promise<unknown> = Promise.resolve();
  private readonly oyentes = new Set<() => void>();

  constructor(deps: Dependencias) {
    this.deps = deps;
  }

  suscribir = (oyente: () => void): (() => void) => {
    this.oyentes.add(oyente);
    return () => { this.oyentes.delete(oyente); };
  };

  private cambiar(estado: EstadoMotor) {
    if (this.estado === estado) return;
    this.estado = estado;
    for (const oyente of this.oyentes) oyente();
  }

  private soltar() {
    try { this.webR?.close(); } catch { /* ya estaba muerto */ }
    this.webR = null;
  }

  /**
   * Deja R encendido con los paquetes y las tablas de la sesión. Idempotente:
   * el lobby y la ronda lo llaman los dos. NUNCA rechaza — lo llaman efectos de
   * React, y lo que hay que mirar es `estado`.
   */
  preparar(config: ConfigR): Promise<void> {
    const clave = claveDe(config);
    const enCurso = this.estado === 'cargando' || this.estado === 'listo';
    if (this.preparando && this.clave === clave && enCurso) return this.preparando;

    const anterior = this.preparando ?? Promise.resolve();
    const generacion = ++this.generacion;
    this.config = config;
    this.clave = clave;
    this.error = null;
    this.cambiar('cargando');

    const t0 = Date.now();
    this.preparando = anterior
      .then(() => this.conLimite(this.armar(config), TIMEOUT_CARGA_MS))
      .then(() => {
        if (generacion !== this.generacion) return;
        this.msCarga = Date.now() - t0;
        this.cambiar('listo');
      })
      .catch((e) => {
        if (generacion !== this.generacion) return;
        this.error = mensajeDe(e);
        this.soltar();
        this.cambiar('fallo');
      });
    return this.preparando;
  }

  /**
   * Vuelve a cargar R sólo si la carga anterior quedó en `'fallo'`, con la
   * última configuración pedida. Lo llaman la vuelta a la pestaña y el comienzo
   * de cada ronda de código.
   *
   * Existe por la corrida en seco del 15-nov-2026: en un Android que ya había
   * cargado R sin problema en la vista previa, el juego mostró «R no cargó».
   * La página de la ronda es la misma de una ronda a otra, así que el `preparar`
   * del montaje corre una sola vez; si la carga se cae mientras el teléfono
   * está apagado o en otra app (Android congela la pestaña, el corte de 120 s
   * vence o la descarga se corta), nada la volvía a intentar salvo el enlace
   * «Reintentar», que nadie aprieta con el reloj corriendo.
   */
  reintentarSiFallo(): void {
    if (this.estado === 'fallo' && this.config) void this.preparar(this.config);
  }

  private async armar(config: ConfigR): Promise<void> {
    if (!this.webR) {
      const { WebR, ChannelType } = await this.deps.cargar();
      // PostMessage a propósito: el canal rápido pide cabeceras COOP/COEP que
      // GitHub Pages no puede mandar.
      const nuevo = new WebR({ channelType: ChannelType.PostMessage });
      // Se guarda ANTES del init: si el init falla, `soltar()` tiene que poder
      // cerrar el worker que ya se creó.
      this.webR = nuevo;
      await nuevo.init();
    }
    const w = this.webR;
    if (config.packages.length > 0) {
      await w.installPackages(config.packages, { quiet: true });
    }
    for (const archivo of config.files ?? []) {
      const bytes = await this.deps.traer(archivo.src);
      await w.FS.writeFile(`${DIRECTORIO_R}/${archivo.name}`, bytes);
    }
    const librerias = config.packages.map((p) => `library(${p})`).join('; ');
    await w.evalRVoid(`suppressPackageStartupMessages({ ${librerias} })`);
    if (config.setup?.trim()) await w.evalRVoid(config.setup);
  }

  private conLimite<T>(trabajo: Promise<T>, ms: number): Promise<T> {
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<never>((_, rechazar) => {
      reloj = setTimeout(() => rechazar(new Error('R tardó demasiado en cargar.')), ms);
    });
    return Promise.race([trabajo, limite]).finally(() => clearTimeout(reloj));
  }

  /**
   * Ejecuta el código del alumno. Nunca rechaza: un error de R, un corte por
   * tiempo o un R que no cargó vuelven todos como `ok: false`. Las llamadas se
   * encolan — hay un solo R y no puede hacer dos cosas a la vez.
   */
  ejecutar(codigo: string): Promise<ResultadoR> {
    const turno = this.cola.then(() => this.ejecutarAhora(codigo));
    this.cola = turno.catch(() => undefined);
    return turno;
  }

  private async ejecutarAhora(codigo: string): Promise<ResultadoR> {
    const t0 = Date.now();
    const w = this.webR;
    if (this.estado !== 'listo' || !w) {
      return { ok: false, texto: 'R todavía no está listo en este teléfono.', imagen: null, ms: 0 };
    }

    let reloj: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<'corte'>((resolver) => {
      reloj = setTimeout(() => resolver('corte'), TIMEOUT_EJECUCION_MS);
    });
    const trabajo = this.correr(w, codigo);
    const resultado = await Promise.race([trabajo, limite]);
    clearTimeout(reloj);

    if (resultado === 'corte') {
      // Con el canal PostMessage no se puede interrumpir a R: lo único que hay
      // es matar el worker y encender otro. Mientras tanto el botón dice
      // «cargando», y enviar sigue funcionando.
      this.soltar();
      this.cambiar('inactivo');
      if (this.config) void this.preparar(this.config);
      const segundos = Math.round(TIMEOUT_EJECUCION_MS / 1000);
      return {
        ok: false,
        cortado: true,
        texto: `Tu código pasó de ${segundos} s y se cortó. R se está reiniciando.`,
        imagen: null,
        ms: Date.now() - t0,
      };
    }
    return { ...resultado, ms: Date.now() - t0 };
  }

  private async correr(w: WebRLike, codigo: string): Promise<Omit<ResultadoR, 'ms'>> {
    let refugio: RefugioWebR | null = null;
    try {
      refugio = await new w.Shelter();
      await w.objs.globalEnv.bind('.codigo', normalizarCodigo(codigo));
      const captura = await refugio.captureR(ENVOLTORIO, OPCIONES_CAPTURA);

      const lineas: string[] = [];
      for (const o of captura.output) {
        if (typeof o.data === 'string') {
          lineas.push(o.data);
        } else {
          const msj = await textoDeCondicion(o);
          if (msj) lineas.push(msj);
        }
      }

      // Sólo se muestra el último gráfico. Los demás se sueltan acá mismo: un
      // ImageBitmap que nadie cierra es memoria del teléfono que no vuelve.
      const imagenes = captura.images;
      for (const sobrante of imagenes.slice(0, -1)) sobrante.close();
      const imagen = imagenes.length > 0 ? imagenes[imagenes.length - 1] : null;

      return { ok: true, texto: recortarSalida(lineas.join('\n')), imagen };
    } catch (e) {
      return { ok: false, texto: limpiarError(mensajeDe(e)), imagen: null };
    } finally {
      try { await refugio?.purge(); } catch { /* el worker ya no está */ }
    }
  }
}

async function traerDesdePublic(src: string): Promise<Uint8Array> {
  const respuesta = await fetch(resolveMediaSrc(src));
  if (!respuesta.ok) throw new Error(`no se pudo bajar ${src} (${respuesta.status})`);
  return new Uint8Array(await respuesta.arrayBuffer());
}

/**
 * Uno solo para toda la app, a nivel de módulo: tiene que sobrevivir la
 * navegación del lobby a la ronda, que es justo para lo que se precarga.
 */
export const motorR = new MotorR({
  cargar: () => import(/* @vite-ignore */ URL_WEBR) as Promise<ModuloWebR>,
  traer: traerDesdePublic,
});
