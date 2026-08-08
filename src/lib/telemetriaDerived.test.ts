import { describe, it, expect } from 'vitest';
import { formatoReloj, proporcionPegada } from './telemetriaDerived';

describe('formatoReloj', () => {
  it('bajo el minuto muestra solo segundos', () => {
    expect(formatoReloj(0)).toBe('0 s');
    expect(formatoReloj(41_000)).toBe('41 s');
    expect(formatoReloj(59_999)).toBe('59 s');
  });

  it('sobre el minuto muestra minutos y segundos', () => {
    expect(formatoReloj(138_000)).toBe('2 min 18 s');
  });

  it('omite los segundos cuando son cero', () => {
    expect(formatoReloj(180_000)).toBe('3 min');
  });
});

describe('proporcionPegada', () => {
  it('es 0 cuando no hubo ningun pegado', () => {
    expect(proporcionPegada({ charsPegados: 0, largoFinal: 400 })).toBe(0);
  });

  it('es la fraccion del texto final que llego pegada', () => {
    expect(proporcionPegada({ charsPegados: 200, largoFinal: 400 })).toBe(0.5);
  });

  it('no pasa de 1 aunque hayan pegado y despues borrado', () => {
    expect(proporcionPegada({ charsPegados: 900, largoFinal: 400 })).toBe(1);
  });

  it('es 0 con respuesta vacia, sin dividir por cero', () => {
    expect(proporcionPegada({ charsPegados: 0, largoFinal: 0 })).toBe(0);
  });
});
