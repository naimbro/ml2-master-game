import type { PegadoEvento, TelemetriaCaptura } from './telemetriaDerived';

export const HUELLA_INTERVALO_MS = 2000;
/** 600 muestras a 2 s son 20 min de ronda. Mas alla deja de crecer. */
const MAX_MUESTRAS = 600;
/** Un documento con 40 pegados ya conto la historia. */
const MAX_PEGADOS = 40;
/**
 * Ventana para tratar el evento `paste` y la insercion que lo sigue como UN
 * pegado. Los dos llegan en el mismo tick del navegador; 200 ms es holgado
 * para eso y sigue siendo mas rapido de lo que una persona pega dos veces.
 */
const DEDUPE_PEGADO_MS = 200;
/** Un teclado no tiene doce nombres distintos para insertar texto. */
const MAX_TIPOS_INSERCION = 12;

interface Opciones {
  ahora: () => number;
  scenarioId: string;
  /** `game.roundStartTime` en ms, o null si todavia no se sabe. */
  roundStartMs: number | null;
}

/**
 * Lleva la cuenta de COMO se escribio una respuesta abierta: cuando aparecio la
 * primera letra, que se pego, cuanto se edito despues y cuanto rato estuvo el
 * alumno fuera de la app.
 *
 * Es una clase pura con el reloj inyectado a proposito: toda la logica que se
 * puede equivocar vive aca y se prueba sin React y sin navegador. El hook que
 * la usa (`useTypingTelemetry`) no tiene ninguna decision propia.
 *
 * NO decide nada sobre la persona. No hay umbrales, no hay banderas, no hay un
 * campo "sospechoso". Devuelve lo que paso.
 *
 * Ver docs/superpowers/specs/2026-08-08-telemetria-antitrampa-design.md
 */
export class RegistroEscritura {
  private readonly ahora: () => number;
  private readonly scenarioId: string;
  private readonly inicio: number;
  private readonly roundStartOffset: number;

  private largo = 0;
  private msPrimeraTecla: number | null = null;
  private pegados: PegadoEvento[] = [];
  private charsPegados = 0;
  private huella: number[] = [];
  private msFueraDeApp = 0;
  private salidas = 0;
  private msFueraAntesDeEscribir = 0;
  private ocultoDesde: number | null = null;
  private huboPegado = false;
  private editadosTrasPegado = 0;
  /**
   * El evento `paste` corre ANTES de que el textarea actualice su value, asi
   * que el `cambio` que viene justo despues es el pegado mismo. Sin esta
   * bandera, cada pegado se contaria ademas como edicion posterior de su propio
   * tamano, que es exactamente al reves de lo que el campo quiere decir.
   */
  private saltarProximoCambio = false;
  /** Para deduplicar: el menu del navegador dispara los DOS eventos. */
  private msUltimoPegado: number | null = null;
  /** El navegador no dijo el tamano; lo mide el cambio que viene. */
  private esperandoMedida = false;
  /** Donde quedo el pegado a medir, o null si no cupo por el tope. */
  private idxPendiente: number | null = null;
  private maxInsercion = 0;
  private tiposDeInsercion: string[] = [];

  constructor(opciones: Opciones) {
    this.ahora = opciones.ahora;
    this.scenarioId = opciones.scenarioId;
    this.inicio = opciones.ahora();
    this.roundStartOffset = opciones.roundStartMs === null ? 0 : this.inicio - opciones.roundStartMs;
  }

  private transcurrido(): number {
    return this.ahora() - this.inicio;
  }

  /** Cada `onChange` del textarea. */
  cambio(valor: string): void {
    const nuevo = valor.length;
    const crecimiento = nuevo - this.largo;
    const delta = Math.abs(crecimiento);

    // El salto mas grande se anota SIEMPRE, venga de donde venga. Es la red
    // para el dia en que aparezca un camino de entrada que no dispare ninguno
    // de los dos eventos de pegado: el hecho queda registrado igual, y el panel
    // lo muestra como hecho sin afirmar nada sobre el.
    if (crecimiento > this.maxInsercion) this.maxInsercion = crecimiento;

    if (this.msPrimeraTecla === null && nuevo > 0) {
      this.msPrimeraTecla = this.transcurrido();
    }

    if (this.saltarProximoCambio) {
      this.saltarProximoCambio = false;
      if (this.esperandoMedida) {
        // El navegador aviso del pegado pero no dijo de que tamano. Este cambio
        // ES el pegado, asi que su crecimiento es la medida.
        this.esperandoMedida = false;
        const medido = Math.max(0, crecimiento);
        this.charsPegados += medido;
        if (this.idxPendiente !== null) this.pegados[this.idxPendiente].chars = medido;
        this.idxPendiente = null;
      }
    } else if (this.huboPegado) {
      this.editadosTrasPegado += delta;
    }

    this.largo = nuevo;
  }

  /**
   * Un pegado, venga del evento `paste` o de una insercion del metodo de
   * entrada. `chars` en null significa "hubo pegado y el navegador no dijo de
   * que tamano": lo mide el cambio siguiente.
   */
  private registrarPegado(chars: number | null): void {
    this.idxPendiente = null;
    if (this.pegados.length < MAX_PEGADOS) {
      this.idxPendiente = this.pegados.length;
      this.pegados.push({ ms: this.transcurrido(), chars: chars ?? 0 });
    }

    if (chars === null) {
      this.esperandoMedida = true;
    } else {
      this.charsPegados += chars;
      this.idxPendiente = null;
    }

    this.msUltimoPegado = this.transcurrido();
    this.huboPegado = true;
    // La edicion posterior se cuenta desde el ULTIMO pegado.
    this.editadosTrasPegado = 0;
    this.saltarProximoCambio = true;
  }

  /** El evento `paste` del navegador, con el largo real del portapapeles. */
  pegado(chars: number | null): void {
    this.registrarPegado(chars);
  }

  /**
   * Una insercion marcada por el navegador como pegado (`beforeinput` con
   * inputType `insertFromPaste`).
   *
   * Existe porque el 8-ago-2026, en un Android real, NINGUN pegado quedo
   * registrado: el chip del portapapeles de Gboard inserta por el metodo de
   * entrada y no dispara `paste`. 465 caracteres entraron de golpe y el
   * registro los conto como tecleados — que es justo la lectura que este
   * sistema no puede permitirse.
   *
   * El menu tactil del navegador, en cambio, dispara los DOS eventos. De ahi la
   * ventana de deduplicacion: sin ella ese caso contaria doble.
   */
  pegadoPorInsercion(chars: number | null): void {
    if (
      this.msUltimoPegado !== null &&
      this.transcurrido() - this.msUltimoPegado < DEDUPE_PEGADO_MS
    ) {
      return;
    }
    this.registrarPegado(chars);
  }

  /**
   * El `inputType` de cada insercion, tal como lo nombra el navegador.
   *
   * Existe porque en el Android real no disparo ni `paste` ni
   * `insertFromPaste`, y no habia manera de saber COMO llama el teclado a esa
   * insercion. En vez de proponer una tercera hipotesis, se anota el nombre.
   *
   * Es dato sobre el navegador, no sobre la persona: la lista de tipos que un
   * teclado usa no dice nada de quien escribe. Se guarda un conjunto, no una
   * secuencia, porque `insertText` llega en cada tecla y la secuencia seria el
   * texto mismo contado de otra forma.
   */
  insercion(inputType: string): void {
    if (this.tiposDeInsercion.length >= MAX_TIPOS_INSERCION) return;
    if (this.tiposDeInsercion.includes(inputType)) return;
    this.tiposDeInsercion.push(inputType);
  }

  /** Un tic del muestreo periodico. */
  muestra(): void {
    if (this.huella.length < MAX_MUESTRAS) this.huella.push(this.largo);
  }

  seOculto(): void {
    if (this.ocultoDesde !== null) return;
    this.ocultoDesde = this.ahora();
    this.salidas += 1;
  }

  seMostro(): void {
    if (this.ocultoDesde === null) return;
    const fuera = this.ahora() - this.ocultoDesde;
    this.msFueraDeApp += fuera;
    if (this.msPrimeraTecla === null) this.msFueraAntesDeEscribir += fuera;
    this.ocultoDesde = null;
  }

  /** La foto que se escribe en Firestore. Se puede llamar mas de una vez. */
  cerrar(): TelemetriaCaptura {
    // Enviar con la pestana oculta no deberia pasar, pero si pasa el rato de
    // afuera no se puede perder: se cierra la salida en curso.
    this.seMostro();

    return {
      scenarioId: this.scenarioId,
      msPrimeraTecla: this.msPrimeraTecla,
      msEnvio: this.transcurrido(),
      roundStartOffsetMs: this.roundStartOffset,
      pegados: this.pegados.slice(),
      huella: this.huella.slice(),
      huellaIntervaloMs: HUELLA_INTERVALO_MS,
      msFueraDeApp: this.msFueraDeApp,
      salidas: this.salidas,
      msFueraAntesDeEscribir: this.msFueraAntesDeEscribir,
      largoFinal: this.largo,
      charsPegados: this.charsPegados,
      charsEditadosTrasUltimoPegado: this.editadosTrasPegado,
      maxInsercionDeGolpe: this.maxInsercion,
      tiposDeInsercion: this.tiposDeInsercion.slice(),
    };
  }
}
