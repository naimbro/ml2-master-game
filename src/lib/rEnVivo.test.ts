import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MotorR, normalizarCodigo, limpiarError, recortarSalida, claveDe, configRDe,
  contadorVacio, anotarPrueba, telemetriaR, TIMEOUT_EJECUCION_MS,
  type ConfigR, type ModuloWebR,
} from './rEnVivo';

/**
 * Lo que se prueba acá es todo lo que NO necesita un R de verdad: qué se le
 * hace al código antes de ejecutarlo, qué se le hace al mensaje antes de
 * mostrarlo, y que el motor nunca deje al alumno esperando algo que no va a
 * llegar. Que webR dibuje un ggplot se verifica en `/preview-probar`, en un
 * navegador, porque ningún test de node puede decirlo.
 */

describe('normalizarCodigo', () => {
  it('convierte las comillas tipográficas, que R real no acepta', () => {
    // Medido el 14-nov-2026 en webR: `geom_bar(fill = “blue”)` da
    // «unexpected input». La rúbrica las perdona porque escriben desde el
    // teléfono, así que el botón no puede cobrar lo que los jueces no cobran.
    expect(normalizarCodigo('geom_bar(fill = “blue”)')).toBe('geom_bar(fill = "blue")');
    expect(normalizarCodigo('filter(transporte == ‘Metro’)')).toBe("filter(transporte == 'Metro')");
  });

  it('cambia el espacio duro por un espacio normal', () => {
    const duro = String.fromCharCode(0x00a0);
    expect(normalizarCodigo(`aes(x${duro}=${duro}transporte)`)).toBe('aes(x = transporte)');
  });

  it('borra los caracteres de ancho cero que mete el teclado', () => {
    const anchoCero = String.fromCharCode(0x200b);
    expect(normalizarCodigo(`geom_bar${anchoCero}()`)).toBe('geom_bar()');
  });

  it('no toca nada más: mayúsculas, saltos de línea y espacios quedan igual', () => {
    const codigo = 'ggplot(curso, aes(x = Transporte)) +\n  geom_bar()';
    expect(normalizarCodigo(codigo)).toBe(codigo);
  });
});

describe('limpiarError', () => {
  it('quita el prefijo que agrega webR y deja el mensaje de R', () => {
    expect(limpiarError("Error in unknown source: Error in `geom_bar()`:\n! object 'Transporte' not found"))
      .toBe("Error in `geom_bar()`:\n! object 'Transporte' not found");
  });

  it('deja pasar un mensaje que no trae el prefijo', () => {
    expect(limpiarError('  algo raro  ')).toBe('algo raro');
  });

  it('nunca devuelve vacío: un error sin texto igual es un error', () => {
    expect(limpiarError('')).toBe('R devolvió un error sin mensaje.');
  });
});

describe('recortarSalida', () => {
  it('deja pasar una salida corta sin tocarla', () => {
    expect(recortarSalida('a\nb')).toBe('a\nb');
  });

  it('corta una tabla larga y dice cuántas líneas faltan', () => {
    const tabla = Array.from({ length: 100 }, (_, i) => `fila ${i}`).join('\n');
    const corta = recortarSalida(tabla, 10).split('\n');
    expect(corta).toHaveLength(11);
    expect(corta[10]).toBe('… (90 líneas más)');
  });
});

describe('claveDe', () => {
  it('dos configuraciones iguales dan la misma clave aunque sean objetos distintos', () => {
    const a: ConfigR = { packages: ['ggplot2'], setup: 'x <- 1' };
    const b: ConfigR = { packages: ['ggplot2'], setup: 'x <- 1' };
    expect(claveDe(a)).toBe(claveDe(b));
  });

  it('cambia si cambia el código que prepara las tablas', () => {
    expect(claveDe({ packages: ['ggplot2'], setup: 'x <- 1' }))
      .not.toBe(claveDe({ packages: ['ggplot2'], setup: 'x <- 2' }));
  });
});

describe('configRDe', () => {
  const r = { packages: ['ggplot2'], files: [{ name: 'x.csv', src: 'datos/x.csv' }], setup: 'x <- 1' };
  const conCodigo = [{ answerFormat: 'prose' }, { answerFormat: 'code' }];

  it('devuelve el bloque cuando está bien y hay una ronda de código', () => {
    expect(configRDe({ rEnVivo: r }, conCodigo)).toEqual(r);
  });

  it('las sesiones de antes, que no traen el bloque, quedan sin botón', () => {
    expect(configRDe({}, conCodigo)).toBeNull();
    expect(configRDe(undefined, conCodigo)).toBeNull();
  });

  it('sin ninguna ronda de código no se baja R', () => {
    expect(configRDe({ rEnVivo: r }, [{ answerFormat: 'prose' }, {}])).toBeNull();
    expect(configRDe({ rEnVivo: r }, undefined)).toBeNull();
  });

  it('un bloque mal formado da «sin botón», no una excepción', () => {
    // Viene de Firestore: el tipo de TypeScript no garantiza nada.
    expect(configRDe({ rEnVivo: 'ggplot2' }, conCodigo)).toBeNull();
    expect(configRDe({ rEnVivo: { packages: 'ggplot2' } }, conCodigo)).toBeNull();
    expect(configRDe({ rEnVivo: { packages: ['ggplot2); q('] } }, conCodigo)).toBeNull();
    expect(configRDe({ rEnVivo: { packages: ['ggplot2'], files: [{ name: 'x.csv' }] } }, conCodigo)).toBeNull();
    expect(configRDe({ rEnVivo: { packages: ['ggplot2'], setup: 5 } }, conCodigo)).toBeNull();
  });
});

describe('anotarPrueba', () => {
  it('cuenta pruebas y errores, y recuerda cómo salió la última', () => {
    let c = contadorVacio();
    expect(c).toEqual({ pruebas: 0, errores: 0, ultimaOk: null });
    c = anotarPrueba(c, false);
    c = anotarPrueba(c, false);
    c = anotarPrueba(c, true);
    expect(c).toEqual({ pruebas: 3, errores: 2, ultimaOk: true });
  });

  it('lo que va a Firestore no trae ningún undefined', () => {
    // Firestore rechaza el documento ENTERO por un solo undefined, y esto viaja
    // pegado a la telemetría de escritura: se la llevaría consigo.
    const t = telemetriaR(contadorVacio(), { estado: 'fallo', msCarga: null });
    expect(t).toEqual({ pruebas: 0, errores: 0, ultimaOk: null, estado: 'fallo', msCarga: null });
    expect(Object.values(t)).not.toContain(undefined);
  });
});

// ---------------------------------------------------------------------------
// El motor, contra un webR de mentira
// ---------------------------------------------------------------------------

interface Llamadas {
  init: number;
  paquetes: string[][];
  archivos: string[];
  evaluado: string[];
  ligado: unknown[];
  cerrado: number;
}

function webRFalso(opciones: {
  capturar?: (codigo: unknown) => Promise<{ output: { type: string; data: unknown }[]; images: unknown[] }>;
  initFalla?: boolean;
} = {}) {
  const llamadas: Llamadas = { init: 0, paquetes: [], archivos: [], evaluado: [], ligado: [], cerrado: 0 };
  let ultimoLigado: unknown = null;

  class WebR {
    FS = {
      writeFile: async (ruta: string) => { llamadas.archivos.push(ruta); },
    };
    objs = {
      globalEnv: {
        bind: async (_nombre: string, valor: unknown) => { ultimoLigado = valor; llamadas.ligado.push(valor); },
      },
    };
    Shelter = class {
      constructor() {
        return Promise.resolve({
          captureR: () => (opciones.capturar
            ? opciones.capturar(ultimoLigado)
            : Promise.resolve({ output: [], images: [] })),
          purge: async () => {},
        }) as never;
      }
    } as never;
    async init() {
      llamadas.init += 1;
      if (opciones.initFalla) throw new Error('sin red');
    }
    async installPackages(p: string[]) { llamadas.paquetes.push(p); }
    async evalRVoid(codigo: string) { llamadas.evaluado.push(codigo); }
    close() { llamadas.cerrado += 1; }
  }

  const modulo = { WebR, ChannelType: { PostMessage: 'post-message' } } as unknown as ModuloWebR;
  return { modulo, llamadas };
}

const CONFIG: ConfigR = {
  packages: ['ggplot2', 'dplyr'],
  files: [{ name: 'encuesta_curso.csv', src: 'datos/dataviz/encuesta_curso.csv' }],
  setup: 'curso <- read.csv("encuesta_curso.csv")',
};

function motorCon(falso: ReturnType<typeof webRFalso>, extra: { traer?: () => Promise<Uint8Array> } = {}) {
  const cargar = vi.fn(async () => falso.modulo);
  const traer = vi.fn(extra.traer ?? (async () => new Uint8Array([1, 2, 3])));
  const motor = new MotorR({ cargar, traer });
  return { motor, cargar, traer };
}

describe('MotorR.preparar', () => {
  it('parte inactivo y termina listo, con los paquetes, los archivos y las tablas puestos', async () => {
    const falso = webRFalso();
    const { motor, traer } = motorCon(falso);
    expect(motor.estado).toBe('inactivo');

    const estados: string[] = [];
    motor.suscribir(() => estados.push(motor.estado));
    await motor.preparar(CONFIG);

    expect(motor.estado).toBe('listo');
    expect(estados).toEqual(['cargando', 'listo']);
    expect(falso.llamadas.paquetes).toEqual([['ggplot2', 'dplyr']]);
    expect(traer).toHaveBeenCalledWith('datos/dataviz/encuesta_curso.csv');
    expect(falso.llamadas.archivos).toEqual(['/home/web_user/encuesta_curso.csv']);
    // Primero las librerías, después el código de la sesión: el setup usa
    // funciones de los paquetes.
    expect(falso.llamadas.evaluado[0]).toContain('library(ggplot2)');
    expect(falso.llamadas.evaluado[0]).toContain('library(dplyr)');
    expect(falso.llamadas.evaluado[1]).toBe(CONFIG.setup);
    expect(motor.msCarga).not.toBeNull();
  });

  it('llamarlo dos veces con lo mismo no carga R dos veces', async () => {
    // El lobby y la ronda lo llaman los dos: si esto no fuera idempotente, cada
    // alumno bajaría R de nuevo al empezar la ronda 1.
    const falso = webRFalso();
    const { motor, cargar } = motorCon(falso);
    await Promise.all([motor.preparar(CONFIG), motor.preparar({ ...CONFIG })]);
    await motor.preparar(CONFIG);
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(falso.llamadas.init).toBe(1);
  });

  it('si R no enciende queda en fallo, NO rechaza, y se puede reintentar', async () => {
    // No rechaza a propósito: lo llaman efectos de React, y una promesa
    // rechazada ahí es un error sin manejar en la consola del alumno.
    const falso = webRFalso({ initFalla: true });
    const { motor, cargar } = motorCon(falso);
    await expect(motor.preparar(CONFIG)).resolves.toBeUndefined();
    expect(motor.estado).toBe('fallo');
    expect(motor.error).toContain('sin red');

    await motor.preparar(CONFIG);
    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('reintentarSiFallo vuelve a cargar sólo cuando quedó en fallo', async () => {
    // Un teléfono que se apagó en el lobby queda en fallo; al volver a la
    // pantalla o al empezar una ronda de código hay que reintentar solo.
    let falla = true;
    const { motor, cargar, traer } = motorCon(webRFalso(), {
      traer: async () => {
        if (falla) throw new Error('se cortó la red');
        return new Uint8Array([1]);
      },
    });
    motor.reintentarSiFallo(); // sin config todavía: no hace nada
    expect(cargar).toHaveBeenCalledTimes(0);

    await motor.preparar(CONFIG);
    expect(motor.estado).toBe('fallo');

    falla = false;
    motor.reintentarSiFallo();
    await vi.waitFor(() => expect(motor.estado).toBe('listo'));

    // Ya listo: otro llamado no vuelve a bajar nada.
    const traidosAntes = traer.mock.calls.length;
    motor.reintentarSiFallo();
    expect(traer.mock.calls.length).toBe(traidosAntes);
  });

  it('si un CSV no baja, queda en fallo y no en un «listo» sin datos', async () => {
    const falso = webRFalso();
    const { motor } = motorCon(falso, { traer: async () => { throw new Error('404'); } });
    await motor.preparar(CONFIG);
    expect(motor.estado).toBe('fallo');
  });
});

describe('MotorR.ejecutar', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sin R listo responde de inmediato en vez de colgarse', async () => {
    const { motor } = motorCon(webRFalso());
    const r = await motor.ejecutar('1 + 1');
    expect(r.ok).toBe(false);
    expect(r.texto).toMatch(/no está listo/);
  });

  it('le pasa a R el código ya normalizado', async () => {
    const falso = webRFalso();
    const { motor } = motorCon(falso);
    await motor.preparar(CONFIG);
    await motor.ejecutar('geom_bar(fill = “blue”)');
    expect(falso.llamadas.ligado).toEqual(['geom_bar(fill = "blue")']);
  });

  it('devuelve el texto de la salida y el último gráfico, y suelta los demás', async () => {
    const cerrar1 = vi.fn();
    const img1 = { close: cerrar1 };
    const img2 = { close: vi.fn() };
    const falso = webRFalso({
      capturar: async () => ({
        output: [
          { type: 'stdout', data: '[1] 2' },
          { type: 'warning', data: { get: async () => ({ toArray: async () => ['ojo'] }) } },
          { type: 'message', data: { get: async () => ({ toArray: async () => ['hola\n'] }) } },
        ],
        images: [img1, img2],
      }),
    });
    const { motor } = motorCon(falso);
    await motor.preparar(CONFIG);
    const r = await motor.ejecutar('x');
    expect(r.ok).toBe(true);
    expect(r.texto).toBe('[1] 2\nWarning: ojo\nhola');
    expect(r.imagen).toBe(img2);
    // Un ImageBitmap que nadie cierra es memoria del teléfono que no vuelve.
    expect(cerrar1).toHaveBeenCalled();
    expect(img2.close).not.toHaveBeenCalled();
  });

  it('un error de R vuelve como resultado, limpio, y no como excepción', async () => {
    const falso = webRFalso({
      capturar: async () => { throw new Error("Error in unknown source: object 'Transporte' not found"); },
    });
    const { motor } = motorCon(falso);
    await motor.preparar(CONFIG);
    const r = await motor.ejecutar('x');
    expect(r).toMatchObject({ ok: false, texto: "object 'Transporte' not found", imagen: null });
    // R sigue vivo: un error del alumno no es un fallo del motor.
    expect(motor.estado).toBe('listo');
  });

  it('un código que no termina se corta, y R se reinicia solo', async () => {
    // El canal PostMessage no puede interrumpir a R: lo único que hay es matar
    // el worker. Sin esto, un `while (TRUE) {}` deja el botón muerto hasta el
    // final del juego.
    const falso = webRFalso({ capturar: () => new Promise(() => {}) });
    const { motor, cargar } = motorCon(falso);
    await motor.preparar(CONFIG);

    const pendiente = motor.ejecutar('while (TRUE) {}');
    await vi.advanceTimersByTimeAsync(TIMEOUT_EJECUCION_MS + 1);
    const r = await pendiente;

    expect(r.ok).toBe(false);
    expect(r.cortado).toBe(true);
    expect(falso.llamadas.cerrado).toBe(1);
    await vi.runAllTimersAsync();
    expect(cargar).toHaveBeenCalledTimes(2);
    expect(motor.estado).toBe('listo');
  });

  it('dos ejecuciones seguidas no se pisan: la segunda espera a la primera', async () => {
    const orden: string[] = [];
    let soltar: () => void = () => {};
    const falso = webRFalso({
      capturar: async (codigo) => {
        orden.push(`entra ${codigo}`);
        if (codigo === 'a') await new Promise<void>((res) => { soltar = res; });
        orden.push(`sale ${codigo}`);
        return { output: [], images: [] };
      },
    });
    const { motor } = motorCon(falso);
    await motor.preparar(CONFIG);
    const a = motor.ejecutar('a');
    const b = motor.ejecutar('b');
    await vi.advanceTimersByTimeAsync(10);
    soltar();
    await Promise.all([a, b]);
    expect(orden).toEqual(['entra a', 'sale a', 'entra b', 'sale b']);
  });
});
