import { describe, expect, it } from 'vitest';
import { instrumentoDe } from './instrumentos';
import { sintetizar } from './sinteticos';
import { calcularVista } from './vista';
import { inundar } from './analitica/puentes';

describe('calcularVista', () => {
  const { matriz } = sintetizar(instrumentoDe('ayd14_vina_v1')!, { semilla: 5, n: 25, replicas: 2 });
  const v = calcularVista(matriz);
  it('arma las camaras presentes', () => {
    expect(Object.keys(v.porCamara).sort()).toEqual(['avatar:sintetico', 'avatar_red', 'humano']);
  });
  it('correlaciona cada camara contra humanos', () => {
    expect(v.correlaciones['avatar:sintetico'].promedio).not.toBeNull();
    expect(v.correlaciones.humano).toBeUndefined();
  });
  it('sin avatares todavia: solo la camara humana, sin romperse', () => {
    const solo = { ...matriz, personas: matriz.personas.filter((p) => p.fuente === 'humano') };
    const ids = new Set(solo.personas.map((p) => p.id));
    const w = calcularVista({ ...solo, votos: matriz.votos.filter((x) => ids.has(x.persona)) });
    expect(Object.keys(w.porCamara)).toEqual(['humano']);
  });
  it('una sala vacia no revienta', () => {
    const w = calcularVista({ ...matriz, personas: [], votos: [] });
    expect(Object.keys(w.porCamara)).toEqual([]);
    expect(w.mapa.puntos).toEqual([]);
  });
  it('con incluirBotsEnSala los bots cuentan en la sala y mueven la mayoria', () => {
    const solo = { ...matriz, personas: matriz.personas.filter((p) => p.fuente === 'humano') };
    const ids = new Set(solo.personas.map((p) => p.id));
    const base = { ...solo, votos: matriz.votos.filter((x) => ids.has(x.persona)) };
    const id = base.personas[0].id;
    const sin = calcularVista(base).porCamara.humano.aprobacion;
    const con = calcularVista(inundar(base, id, 30), true).porCamara.humano.aprobacion;
    expect(Object.keys(con).some((k) => Math.abs(con[k].tasa - sin[k].tasa) > 0.1)).toBe(true);
  });
});
