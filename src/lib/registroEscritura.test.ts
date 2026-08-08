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
});
