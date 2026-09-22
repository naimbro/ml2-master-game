// src/lib/abiertaTiming.test.ts
import { describe, it, expect } from 'vitest';
import {
  palabrasDelEnunciado, costoDeLectura, costoDeEscritura, relojDerivadoAbierta,
  formatoDe, dificultadDe, ESCRITURA_SEGUNDOS,
  relojEfectivoDeRonda, EXTENSION_SEGUNDOS,
} from './abiertaTiming';

describe('palabrasDelEnunciado', () => {
  it('suma context y question, que es como viaja un escenario', () => {
    expect(palabrasDelEnunciado({
      context: 'Tenés una tabla de ventas por región.',
      question: '¿Qué línea agrega la columna?',
    })).toBe(12);
  });

  it('usa prompt cuando el escenario viene del generador y no trae context', () => {
    expect(palabrasDelEnunciado({ prompt: 'una dos tres' })).toBe(3);
  });

  it('un escenario vacío no rompe', () => {
    expect(palabrasDelEnunciado({})).toBe(0);
  });

  it('cobra context O prompt, no los dos: la pantalla muestra uno solo', () => {
    // Round.tsx renderiza `context ?? prompt`. Cobrar los dos seria exigir
    // reloj por texto que el alumno nunca ve.
    expect(palabrasDelEnunciado({
      context: 'una dos tres',
      prompt: 'cuatro cinco seis siete ocho',
      question: 'nueve diez',
    })).toBe(5);
  });
});

describe('costoDeLectura', () => {
  // La recta sale de 35 rondas con telemetría: 13 s + 0,32 s por palabra.
  it('cobra 13 s de piso más un tercio de segundo por palabra en prosa', () => {
    expect(costoDeLectura(100, 'prose')).toBe(45);
  });

  it('cobra menos por palabra cuando la respuesta es código', () => {
    // Un bloque de código cuenta muchas "palabras" pero se escanea.
    expect(costoDeLectura(100, 'code')).toBe(38);
  });

  it('reproduce la R4 de 9XR4Z6, que costó 54 s medidos', () => {
    // 179 palabras, answerFormat code -> 13 + 0,25*179 = 57,75 -> 58
    expect(costoDeLectura(179, 'code')).toBe(58);
  });

  it('un enunciado vacío sigue costando el piso', () => {
    expect(costoDeLectura(0, 'prose')).toBe(13);
  });
});

describe('costoDeEscritura', () => {
  it('una línea de código son 70 s, medidos en la R1 de 9XR4Z6', () => {
    // 72 s de escritura mediana, y sólo el 9% seguía escribiendo al final.
    expect(costoDeEscritura('code', 'medium')).toBe(70);
  });

  it('una cadena de dos o tres pasos son 120 s', () => {
    // R3 y R6 de 9XR4Z6: ~120 s de escritura, 33% y 14% colgando.
    expect(costoDeEscritura('code', 'hard')).toBe(120);
  });

  it('la prosa cuesta más que el código a igual etiqueta', () => {
    expect(costoDeEscritura('prose', 'medium')).toBeGreaterThan(
      costoDeEscritura('code', 'medium'),
    );
  });

  it('sin etiqueta asume medium, que es lo que escribe el scaffold', () => {
    expect(costoDeEscritura('prose', undefined)).toBe(costoDeEscritura('prose', 'medium'));
  });

  it('la tabla completa, que es el producto de este modulo', () => {
    // Las seis celdas con su valor exacto. El redondeo a 15 s del reloj puede
    // esconder un error de hasta 14 segundos en una celda, asi que no alcanza
    // con probarlas a traves de relojDerivadoAbierta().
    expect(ESCRITURA_SEGUNDOS).toEqual({
      code: { easy: 45, medium: 70, hard: 120 },
      prose: { easy: 90, medium: 150, hard: 210 },
    });
  });
});

describe('normalización de lo que viene del JSON', () => {
  // Los dos campos vienen de archivos de contenido, que TypeScript no verifica
  // en runtime. Sin esto el reloj sale NaN y el validador falla con un mensaje
  // que no se entiende.
  it('un answerFormat que no existe se trata como prosa', () => {
    expect(formatoDe({ answerFormat: 'Code' })).toBe('prose');
    expect(formatoDe({})).toBe('prose');
    expect(formatoDe({ answerFormat: 'code' })).toBe('code');
  });

  it('un difficulty que no existe se trata como medium', () => {
    expect(dificultadDe('medio')).toBe('medium');
    expect(dificultadDe(undefined)).toBe('medium');
    expect(dificultadDe('hard')).toBe('hard');
  });

  it('un escenario con basura en los dos campos da un número, no NaN', () => {
    const reloj = relojDerivadoAbierta({
      context: 'x '.repeat(50).trim(),
      answerFormat: 'CODIGO' as never,
      difficulty: 'dificil' as never,
    });
    expect(Number.isFinite(reloj)).toBe(true);
    // Cae en prosa + medium: 13 + 0,32*50 = 29 -> +150 = 179 -> 180
    expect(reloj).toBe(180);
  });
});

describe('relojDerivadoAbierta', () => {
  it('le habría dado 180 s a la R4 de 9XR4Z6 en vez de 120', () => {
    const reloj = relojDerivadoAbierta({
      context: 'x '.repeat(179).trim(),
      answerFormat: 'code',
      difficulty: 'hard',
    });
    // 58 s de lectura + 120 de escritura = 178, redondeado a 180.
    expect(reloj).toBe(180);
  });

  it('deja pasar la R1 de 9XR4Z6, que alcanzó de sobra', () => {
    const reloj = relojDerivadoAbierta({
      context: 'x '.repeat(83).trim(),
      answerFormat: 'code',
      difficulty: 'medium',
    });
    // 34 + 70 = 104 -> 105, y la ronda tenía 120.
    expect(reloj).toBe(105);
    expect(reloj).toBeLessThanOrEqual(120);
  });

  it('redondea hacia arriba al múltiplo de 15, nunca hacia abajo', () => {
    const reloj = relojDerivadoAbierta({
      context: 'x '.repeat(10).trim(),
      difficulty: 'easy',
    });
    // 16 + 90 = 106 -> 120
    expect(reloj % 15).toBe(0);
    expect(reloj).toBe(120);
  });

  it('sin answerFormat asume prosa, que es el default del schema', () => {
    const palabras = 'x '.repeat(50).trim();
    expect(relojDerivadoAbierta({ context: palabras, difficulty: 'medium' })).toBe(
      relojDerivadoAbierta({ context: palabras, answerFormat: 'prose', difficulty: 'medium' }),
    );
  });

  it('un crudo que ya es multiplo de 15 se queda quieto', () => {
    // prose/easy, 52 palabras: lectura = round(13 + 0,32*52) = round(29,64) = 30;
    // escritura = 90; crudo = 120, ya multiplo de 15 -> ceil() no debe moverlo
    // a 135. Es el caso que un `+15` en vez de un `ceil` rompería.
    const reloj = relojDerivadoAbierta({
      context: 'x '.repeat(52).trim(),
      difficulty: 'easy',
    });
    expect(reloj).toBe(120);
  });
});

describe('relojEfectivoDeRonda', () => {
  it('sin extensiones es el reloj escrito', () => {
    expect(relojEfectivoDeRonda(120, undefined, 4)).toBe(120);
  });

  it('suma los segundos que el profe agrego en esa ronda', () => {
    expect(relojEfectivoDeRonda(120, { '4': 60 }, 4)).toBe(180);
  });

  it('no mezcla la extension de otra ronda', () => {
    expect(relojEfectivoDeRonda(120, { '3': 60 }, 4)).toBe(120);
  });

  it('un apreton son 30 s', () => {
    expect(EXTENSION_SEGUNDOS).toBe(30);
  });
});
