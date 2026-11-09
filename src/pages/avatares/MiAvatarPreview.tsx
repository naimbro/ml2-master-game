// Hermano de /preview-avatares: el teléfono del alumno en resultados, con un
// alumno y unos avatares inventados, sin login. Ensayo y respaldo visual.
import { VistaMiAvatar } from '../../components/avatares/MiAvatar';
import { instrumentoDe } from '../../lib/avatares/instrumentos';
import type { RespuestaMisAvatares } from '../../lib/avatares/miAvatar';

export default function MiAvatarPreview() {
  const inst = instrumentoDe('ayd14_vina_v1')!;
  const ids = inst.propuestas.map((p) => p.id);
  const tu = [5, 4, 2, 5, 4, 3, 5, 2, 4, 3, 2, 4];
  const conRuido = (ruido: number[]) => Object.fromEntries(ids.map((id, i) => [id, Math.min(5, Math.max(1, tu[i % tu.length] + ruido[i % ruido.length]))]));
  const resp: RespuestaMisAvatares = {
    votos: Object.fromEntries(ids.map((id, i) => [id, tu[i % tu.length]])),
    avatares: [
      { modelo: 'claude-opus-5-5', votos: conRuido([0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0]), faltantes: [] },
      { modelo: 'gpt-6-astra', votos: conRuido([0, -1, 1, 0, 0, 1, -1, 1, 0, -1, 1, 0]), faltantes: [] },
      { modelo: 'gemini-3.1-pro-preview', votos: conRuido([-1, 1, 2, -1, 0, 1, -2, 2, -1, 0, 1, -1]), faltantes: [] },
    ],
    curso: Object.fromEntries(ids.map((id, i) => [id, 3 + ((i * 7) % 5) / 4])),
    nCurso: 24,
    minCurso: 5,
  };
  return <VistaMiAvatar resp={resp} propuestas={inst.propuestas} etiquetas={inst.escala.etiquetas} />;
}
