import { describe, it, expect } from 'vitest';
import { buildJoinUrl } from './joinUrl';

describe('buildJoinUrl', () => {
  it('respeta el prefijo de GitHub Pages', () => {
    expect(buildJoinUrl('ABC123', 'https://naimbro.github.io', '/ml2-master-game/'))
      .toBe('https://naimbro.github.io/ml2-master-game/join?code=ABC123');
  });

  it('funciona en dev, donde la base es /', () => {
    expect(buildJoinUrl('ABC123', 'http://localhost:5173', '/'))
      .toBe('http://localhost:5173/join?code=ABC123');
  });

  it('agrega la barra final si la base no la trae', () => {
    expect(buildJoinUrl('ABC123', 'https://x.io', '/ml2-master-game'))
      .toBe('https://x.io/ml2-master-game/join?code=ABC123');
  });

  it('no duplica la barra si el origen la trae', () => {
    expect(buildJoinUrl('ABC123', 'https://x.io/', '/base/'))
      .toBe('https://x.io/base/join?code=ABC123');
  });

  it('normaliza el codigo a mayusculas y descarta lo que no sea alfanumerico', () => {
    expect(buildJoinUrl('abc-123', 'https://x.io', '/'))
      .toBe('https://x.io/join?code=ABC123');
  });
});
