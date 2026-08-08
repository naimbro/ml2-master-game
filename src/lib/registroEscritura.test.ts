import { describe, it, expect } from 'vitest';
import { RegistroEscritura } from './registroEscritura';

/** Reloj falso: avanza cuando uno lo dice. */
function relojFalso(inicio = 1_000_000) {
  let t = inicio;
  return {
    ahora: () => t,
    avanzar: (ms: number) => { t += ms; },
    inicio,
  };
}

function nuevoRegistro() {
  const reloj = relojFalso();
  const registro = new RegistroEscritura({
    ahora: reloj.ahora,
    scenarioId: 'r3',
    roundStartMs: reloj.inicio,
  });
  return { reloj, registro };
}

/**
 * El 8-ago-2026, jugando en un Android de verdad, NINGUN pegado quedo
 * registrado: el chip del portapapeles de Gboard inserta por el metodo de
 * entrada y no dispara `paste`. 465 caracteres aparecieron de golpe y el
 * registro los conto como tecleados.
 *
 * De ahi salen estos casos: un segundo camino de entrada (`beforeinput` con
 * inputType `insertFromPaste`), la deduplicacion cuando los dos eventos
 * disparan, y un campo que anota el salto mas grande pase lo que pase.
 */
describe('RegistroEscritura — pegados que no disparan `paste`', () => {
  it('registra el pegado cuando solo llego la insercion, sin evento paste', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(45_000);
    registro.pegadoPorInsercion(465);
    registro.cambio('x'.repeat(465));
    const cerrado = registro.cerrar();
    expect(cerrado.pegados).toEqual([{ ms: 45_000, chars: 465 }]);
    expect(cerrado.charsPegados).toBe(465);
  });

  it('no cuenta dos veces cuando los dos eventos disparan por el mismo pegado', () => {
    const { registro } = nuevoRegistro();
    registro.pegado(300);
    registro.pegadoPorInsercion(300);
    registro.cambio('x'.repeat(300));
    const cerrado = registro.cerrar();
    expect(cerrado.pegados).toHaveLength(1);
    expect(cerrado.charsPegados).toBe(300);
  });

  it('si dos pegados estan bien separados en el tiempo, cuenta los dos', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.pegadoPorInsercion(100);
    registro.cambio('x'.repeat(100));
    reloj.avanzar(9000);
    registro.pegadoPorInsercion(50);
    registro.cambio('x'.repeat(150));
    expect(registro.cerrar().pegados).toHaveLength(2);
  });

  it('la edicion posterior se cuenta tambien tras un pegado por insercion', () => {
    const { registro } = nuevoRegistro();
    registro.pegadoPorInsercion(465);
    registro.cambio('x'.repeat(465));
    registro.cambio('x'.repeat(418));
    registro.cambio('x'.repeat(465));
    expect(registro.cerrar().charsEditadosTrasUltimoPegado).toBe(94);
  });

  it('toma el tamano del cambio siguiente cuando el navegador no lo dice', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(20_000);
    registro.pegado(null);
    registro.cambio('x'.repeat(782));
    const cerrado = registro.cerrar();
    expect(cerrado.pegados).toEqual([{ ms: 20_000, chars: 782 }]);
    expect(cerrado.charsPegados).toBe(782);
  });

  it('tambien completa el tamano desconocido de una insercion', () => {
    const { registro } = nuevoRegistro();
    registro.pegadoPorInsercion(null);
    registro.cambio('x'.repeat(240));
    expect(registro.cerrar().charsPegados).toBe(240);
  });
});

describe('RegistroEscritura — el salto mas grande', () => {
  it('anota el mayor crecimiento de un solo cambio', () => {
    const { registro } = nuevoRegistro();
    registro.cambio('x'.repeat(10));
    registro.cambio('x'.repeat(300));
    registro.cambio('x'.repeat(310));
    expect(registro.cerrar().maxInsercionDeGolpe).toBe(290);
  });

  it('existe aunque ningun evento de pegado haya llegado nunca', () => {
    // El caso del Android: el texto entro entero y no hubo pegado registrado.
    const { registro } = nuevoRegistro();
    registro.cambio('x'.repeat(465));
    const cerrado = registro.cerrar();
    expect(cerrado.pegados).toEqual([]);
    expect(cerrado.maxInsercionDeGolpe).toBe(465);
  });

  it('ignora los borrados: solo mira lo que crece', () => {
    const { registro } = nuevoRegistro();
    registro.cambio('x'.repeat(400));
    registro.cambio('');
    expect(registro.cerrar().maxInsercionDeGolpe).toBe(400);
  });

  it('es 0 si nunca se escribio nada', () => {
    const { registro } = nuevoRegistro();
    expect(registro.cerrar().maxInsercionDeGolpe).toBe(0);
  });
});

describe('RegistroEscritura', () => {
  it('marca la primera tecla cuando aparece el primer caracter', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(5000);
    registro.cambio('H');
    expect(registro.cerrar().msPrimeraTecla).toBe(5000);
  });

  it('no marca primera tecla si el texto sigue vacio', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(5000);
    registro.cambio('');
    expect(registro.cerrar().msPrimeraTecla).toBeNull();
  });

  it('la primera tecla no se mueve con las teclas siguientes', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(5000);
    registro.cambio('H');
    reloj.avanzar(9000);
    registro.cambio('Hola');
    expect(registro.cerrar().msPrimeraTecla).toBe(5000);
  });

  it('la huella guarda un largo por muestra, en orden', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.cambio('abc');
    registro.muestra();
    reloj.avanzar(2000);
    registro.cambio('abcdef');
    registro.muestra();
    expect(registro.cerrar().huella).toEqual([3, 6]);
  });

  it('registra el pegado con el tamano del portapapeles', () => {
    const { reloj, registro } = nuevoRegistro();
    reloj.avanzar(30_000);
    registro.pegado(782);
    registro.cambio('x'.repeat(782));
    const cerrado = registro.cerrar();
    expect(cerrado.pegados).toEqual([{ ms: 30_000, chars: 782 }]);
    expect(cerrado.charsPegados).toBe(782);
  });

  it('el cambio que trae el pegado NO cuenta como edicion posterior', () => {
    const { registro } = nuevoRegistro();
    registro.pegado(500);
    registro.cambio('x'.repeat(500));
    expect(registro.cerrar().charsEditadosTrasUltimoPegado).toBe(0);
  });

  it('cuenta lo que se edito despues de pegar', () => {
    const { registro } = nuevoRegistro();
    registro.pegado(500);
    registro.cambio('x'.repeat(500));
    registro.cambio('x'.repeat(520));
    registro.cambio('x'.repeat(510));
    expect(registro.cerrar().charsEditadosTrasUltimoPegado).toBe(30);
  });

  it('la edicion posterior se cuenta desde el ULTIMO pegado', () => {
    const { registro } = nuevoRegistro();
    registro.pegado(100);
    registro.cambio('x'.repeat(100));
    registro.cambio('x'.repeat(180));
    registro.pegado(20);
    registro.cambio('x'.repeat(200));
    registro.cambio('x'.repeat(205));
    expect(registro.cerrar().charsEditadosTrasUltimoPegado).toBe(5);
  });

  it('lo tecleado antes de cualquier pegado no cuenta como edicion posterior', () => {
    const { registro } = nuevoRegistro();
    registro.cambio('x'.repeat(300));
    expect(registro.cerrar().charsEditadosTrasUltimoPegado).toBe(0);
  });

  it('suma el tiempo fuera de la app y cuenta las salidas', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.seOculto();
    reloj.avanzar(41_000);
    registro.seMostro();
    reloj.avanzar(1000);
    registro.seOculto();
    reloj.avanzar(9000);
    registro.seMostro();
    const cerrado = registro.cerrar();
    expect(cerrado.msFueraDeApp).toBe(50_000);
    expect(cerrado.salidas).toBe(2);
  });

  it('separa el tiempo fuera ANTES de escribir del de despues', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.seOculto();
    reloj.avanzar(41_000);
    registro.seMostro();
    registro.cambio('ya escribi');
    registro.seOculto();
    reloj.avanzar(9000);
    registro.seMostro();
    const cerrado = registro.cerrar();
    expect(cerrado.msFueraAntesDeEscribir).toBe(41_000);
    expect(cerrado.msFueraDeApp).toBe(50_000);
  });

  it('cierra una salida que seguia abierta al enviar', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.cambio('algo');
    registro.seOculto();
    reloj.avanzar(7000);
    expect(registro.cerrar().msFueraDeApp).toBe(7000);
  });

  it('guarda el desfase respecto del inicio de la ronda del curso', () => {
    const reloj = relojFalso();
    const registro = new RegistroEscritura({
      ahora: reloj.ahora,
      scenarioId: 'r3',
      roundStartMs: reloj.inicio - 12_000,
    });
    expect(registro.cerrar().roundStartOffsetMs).toBe(12_000);
  });

  it('deja el desfase en 0 cuando no se sabe cuando empezo la ronda', () => {
    const reloj = relojFalso();
    const registro = new RegistroEscritura({ ahora: reloj.ahora, scenarioId: 'r3', roundStartMs: null });
    expect(registro.cerrar().roundStartOffsetMs).toBe(0);
  });

  it('topa la huella y los pegados para no escribir un documento gigante', () => {
    const { registro } = nuevoRegistro();
    for (let i = 0; i < 900; i++) registro.muestra();
    for (let i = 0; i < 90; i++) registro.pegado(1);
    const cerrado = registro.cerrar();
    expect(cerrado.huella).toHaveLength(600);
    expect(cerrado.pegados).toHaveLength(40);
    // los pegados que no caben igual suman al total
    expect(cerrado.charsPegados).toBe(90);
  });

  it('cerrar() es seguro de llamar mas de una vez, incluso tras cerrar una salida abierta', () => {
    const { reloj, registro } = nuevoRegistro();
    registro.muestra();
    registro.pegado(10);
    registro.cambio('x'.repeat(10));
    registro.seOculto();
    reloj.avanzar(7000);
    // El primer cerrar() cierra la salida en curso. El segundo, con el reloj
    // congelado, no deberia sumar nada de nuevo.
    const primero = registro.cerrar();
    const segundo = registro.cerrar();
    expect(segundo.msFueraDeApp).toBe(primero.msFueraDeApp);
    expect(segundo.salidas).toBe(primero.salidas);
    expect(segundo.huella).toEqual(primero.huella);
    expect(segundo.pegados).toEqual(primero.pegados);
  });

  it('las llamadas repetidas de visibilidad no cuentan doble en ninguna direccion', () => {
    const { reloj, registro } = nuevoRegistro();
    // seOculto() repetido sin un seMostro() de por medio: la segunda llamada
    // no debe sumar otra salida ni reiniciar el intervalo que ya empezo.
    registro.seOculto();
    reloj.avanzar(3000);
    registro.seOculto();
    reloj.avanzar(4000);
    registro.seMostro();
    // seMostro() repetido sin un seOculto() de por medio: la segunda llamada
    // no debe sumar tiempo de nuevo.
    registro.seOculto();
    reloj.avanzar(5000);
    registro.seMostro();
    registro.seMostro();
    const cerrado = registro.cerrar();
    expect(cerrado.msFueraDeApp).toBe(12_000); // 7000 (3000+4000, sin reinicio) + 5000
    expect(cerrado.salidas).toBe(2);
  });

  it('cerrar() devuelve copias, no las listas internas', () => {
    const { registro } = nuevoRegistro();
    registro.muestra();
    registro.pegado(5);
    const primero = registro.cerrar();
    primero.huella.push(999);
    primero.pegados.push({ ms: 0, chars: 1 });
    const segundo = registro.cerrar();
    expect(segundo.huella).toEqual([0]);
    expect(segundo.pegados).toEqual([{ ms: 0, chars: 5 }]);
  });
});
