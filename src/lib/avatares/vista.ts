// Todo lo que muestra la sala, calculado de una vez desde la matriz (puro).
// Camaras: la sala (humanos), un parlamento de avatares por modelo, y los
// avatares despues de deliberar en MiroFish (todas las replicas).
import type { Matriz, Persona } from './contrato';
import { aprobacion, correlacionPorPropuesta, dispersion, porFuente, type FiltroPersona } from './analitica/basico';
import { mapaPCA, type Mapa } from './analitica/mapa';
import { factorizacionCN, rankings, type ResultadoCN, type Rankings } from './analitica/puentes';

export interface Camara {
  etiqueta: string;
  rankings: Rankings;
  aprobacion: ReturnType<typeof aprobacion>;
  dispersionMedia: number;
}

export interface Vista {
  mapa: Mapa;
  cn: ResultadoCN;
  porCamara: Record<string, Camara>;
  correlaciones: Record<string, ReturnType<typeof correlacionPorPropuesta>>;
  textos: Record<string, string>;
}

function camaras(m: Matriz, incluirBotsEnSala: boolean): Record<string, { etiqueta: string; filtro: FiltroPersona }> {
  const out: Record<string, { etiqueta: string; filtro: FiltroPersona }> = {};
  if (m.personas.some((p) => p.fuente === 'humano')) {
    out.humano = {
      etiqueta: 'La sala',
      filtro: incluirBotsEnSala ? (p: Persona) => p.fuente === 'humano' || p.fuente === 'bot' : porFuente('humano'),
    };
  }
  const modelos = [...new Set(m.personas.filter((p) => p.fuente === 'avatar').map((p) => p.modelo ?? '?'))].sort();
  for (const mod of modelos) {
    out[`avatar:${mod}`] = {
      etiqueta: `Avatares · ${mod}`,
      filtro: (p: Persona) => p.fuente === 'avatar' && (p.modelo ?? '?') === mod,
    };
  }
  if (m.personas.some((p) => p.fuente === 'avatar_red')) {
    out.avatar_red = { etiqueta: 'Avatares después de deliberar', filtro: porFuente('avatar_red') };
  }
  return out;
}

/** `incluirBotsEnSala`: los bots votan como parte de la sala (la pestaña «Bots»). */
export function calcularVista(m: Matriz, incluirBotsEnSala = false): Vista {
  const cs = camaras(m, incluirBotsEnSala);
  const porCamara: Vista['porCamara'] = {};
  const correlaciones: Vista['correlaciones'] = {};
  for (const [k, { etiqueta, filtro }] of Object.entries(cs)) {
    const d = Object.values(dispersion(m, filtro)).filter(Number.isFinite);
    porCamara[k] = {
      etiqueta,
      rankings: rankings(m, filtro),
      aprobacion: aprobacion(m, filtro),
      dispersionMedia: d.length ? d.reduce((a, b) => a + b, 0) / d.length : NaN,
    };
    if (k !== 'humano' && cs.humano) correlaciones[k] = correlacionPorPropuesta(m, cs.humano.filtro, filtro);
  }
  return {
    mapa: mapaPCA(m),
    cn: factorizacionCN(m, cs.humano?.filtro ?? (() => true)),
    porCamara,
    correlaciones,
    textos: Object.fromEntries(m.instrumento.propuestas.map((p) => [p.id, p.tema ?? p.texto])),
  };
}
