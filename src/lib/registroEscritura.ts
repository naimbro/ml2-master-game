import type { PegadoEvento, TelemetriaCaptura } from './telemetriaDerived';

export const HUELLA_INTERVALO_MS = 2000;
/** 600 muestras a 2 s son 20 min de ronda. Mas alla deja de crecer. */
const MAX_MUESTRAS = 600;
/** Un documento con 40 pegados ya conto la historia. */
const MAX_PEGADOS = 40;

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
    const delta = Math.abs(nuevo - this.largo);

    if (this.msPrimeraTecla === null && nuevo > 0) {
      this.msPrimeraTecla = this.transcurrido();
    }

    if (this.saltarProximoCambio) {
      this.saltarProximoCambio = false;
    } else if (this.huboPegado) {
      this.editadosTrasPegado += delta;
    }

    this.largo = nuevo;
  }

  /** Cada evento `paste`, con el largo real del portapapeles. */
  pegado(chars: number): void {
    if (this.pegados.length < MAX_PEGADOS) {
      this.pegados.push({ ms: this.transcurrido(), chars });
    }
    this.charsPegados += chars;
    this.huboPegado = true;
    // La edicion posterior se cuenta desde el ULTIMO pegado.
    this.editadosTrasPegado = 0;
    this.saltarProximoCambio = true;
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
    };
  }
}
