// Datos sinteticos para probar toda la cadena sin alumnos (spec M6). Parte del
// panel sintetico de MiroFish (40 estudiantes inventados). Los avatares tienen
// sesgos conocidos y configurables: corrimiento progresista (Toubia et al. 2025,
// «blue shift») y menos varianza; los avatares en red, todavia mas homogeneos.
import panel from '../../../content/avatares/fixtures/panel_estudiantes_v1.json';
import { mulberry32 } from './azar';
import { idAvatar, idHumano, idMirofishRed, type Instrumento, type Matriz, type Persona, type Voto } from './contrato';
import type { Planilla } from './planilla';

export interface OpcionesSinteticas {
  semilla?: number; n?: number; corrimiento?: number; contraccion?: number; contraccionRed?: number; replicas?: number;
}

const IDEOLOGIA: Record<string, number> = {
  Izquierda: -1, 'Centro-izquierda': -0.5, Centro: 0, 'Centro-derecha': 0.5, Derecha: 1, Ninguna: 0,
};
// Signo de cada propuesta: +1 si la apoya la izquierda. Las de representacion/ciencia son transversales (0).
const SIGNO: Record<string, number> = {
  salario_minimo: 1, estado_servicios: 1, impuestos_ricos: 1, matrimonio_igualitario: 1, aborto: 1, migracion: 1,
  cambio_climatico: 1, areas_protegidas: 1, regular_ia: 0.5, representantes_humanos: 0, referendos: 0.3, ciencia_democracia: 0,
};

const acotar = (x: number) => Math.min(5, Math.max(1, Math.round(x)));

type PersonaPanel = { id: string; posicion_politica: string; edad: number; sexo: string; ocupacion: string };

export function sintetizar(inst: Instrumento, opts: OpcionesSinteticas = {}) {
  const { semilla = 1, n = 30, corrimiento = 0.4, contraccion = 0.6, contraccionRed = 0.35, replicas = 3 } = opts;
  const r = mulberry32(semilla);
  const ruido = () => (r() + r() + r() - 1.5) * 1.2;
  const gente = (panel as unknown as { personas: PersonaPanel[] }).personas.slice(0, n);
  const personas: Persona[] = [];
  const votos: Voto[] = [];
  const planillas: Record<string, Planilla> = {};
  const media = 3;
  for (const g of gente) {
    const ref = `s${g.id.toLowerCase()}`;
    const x = (IDEOLOGIA[g.posicion_politica] ?? 0) + ruido() * 0.5;
    planillas[ref] = {
      edad: String(g.edad), genero: g.sexo, ocupacion: g.ocupacion,
      economia: x < -0.3 ? 'izquierda redistributiva' : x > 0.3 ? 'derecha liberal de mercado' : 'centro',
      rol_estado: x < -0.3 ? 'fuerte intervención' : x > 0.3 ? 'mínimo' : 'equilibrado',
    };
    const humano: Record<string, number> = {};
    personas.push({ id: idHumano(ref), ref, fuente: 'humano', via: 'simulado' });
    for (const p of inst.propuestas) {
      const v = acotar(media - 1.6 * x * (SIGNO[p.id] ?? 0) + ruido());
      humano[p.id] = v;
      votos.push({ persona: idHumano(ref), propuesta: p.id, valor: v });
    }
    const aId = idAvatar('sintetico', ref);
    personas.push({ id: aId, ref, fuente: 'avatar', via: 'simulado', modelo: 'sintetico' });
    const avatar: Record<string, number> = {};
    for (const p of inst.propuestas) {
      const centro = media + corrimiento * (SIGNO[p.id] ?? 0);
      const v = acotar(centro + contraccion * (humano[p.id] - media) + ruido() * 0.4);
      avatar[p.id] = v;
      votos.push({ persona: aId, propuesta: p.id, valor: v });
    }
    for (let k = 1; k <= replicas; k++) {
      const id = idMirofishRed(k, ref);
      personas.push({ id, ref, fuente: 'avatar_red', via: 'simulado', modelo: 'sintetico', replica: k });
      for (const p of inst.propuestas) {
        const centro = media + 1.2 * corrimiento * (SIGNO[p.id] ?? 0);
        votos.push({ persona: id, propuesta: p.id, valor: acotar(centro + contraccionRed * (avatar[p.id] - media) + ruido() * 0.2) });
      }
    }
  }
  const matriz: Matriz = { instrumento: inst, personas, votos };
  return { matriz, planillas };
}
