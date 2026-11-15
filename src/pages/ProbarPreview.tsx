import { useState } from 'react';
import { Send } from 'lucide-react';
import ProbarCodigo from '../components/ProbarCodigo';
import { useMotorR } from '../hooks/useMotorR';
import { motorR, type ConfigR } from '../lib/rEnVivo';

import sesionC14 from '../../content/sessions/dataviz_2026/clase_14_repaso_del_semestre/config.json';
import rondasC14 from '../../content/sessions/dataviz_2026/clase_14_repaso_del_semestre/scenarios.json';

// El hermano de MCRepartoPreview y CompasPreview, para lo unico de R en vivo
// que ningun test puede decir: si webR carga en ESTE telefono, cuanto tarda, y
// como se ve la tira de «Probar» con un grafico de verdad debajo.
//
// Sin login y sin juego: se abre por /preview-probar desde cualquier telefono.
// El contenido NO es inventado: usa el bloque `rEnVivo` de la sesion de la
// clase 14 de dataviz (el repaso del semestre), asi que las tablas son las
// mismas que vera el alumno en el juego, y los ejemplos son el codigo inicial
// (`codigoInicial`) de cada una de sus rondas, tal como aparece en el cuadro.

const CONFIG: ConfigR = sesionC14.rEnVivo;

const EJEMPLOS: { id: string; nombre: string; codigo: string }[] = rondasC14
  .filter((r) => typeof r.codigoInicial === 'string')
  .map((r) => ({ id: r.id, nombre: `R${r.order} · ${r.title}`, codigo: r.codigoInicial as string }));

export default function ProbarPreview() {
  const [codigo, setCodigo] = useState(EJEMPLOS[0].codigo);
  const [pruebas, setPruebas] = useState(0);
  const estado = useMotorR(CONFIG);

  return (
    <div className="min-h-screen bg-gradient-main px-4 py-6">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Vista previa · R en vivo</p>
        <h1 className="font-display mt-1 text-2xl">Botón «Probar»</h1>
        <p className="mt-2 text-sm font-medium text-ink-soft">
          Dataviz, clase 14, el repaso del semestre: las tablas{' '}
          <code style={{ fontFamily: 'var(--mono)' }}>curso</code>,{' '}
          <code style={{ fontFamily: 'var(--mono)' }}>problemas</code> y{' '}
          <code style={{ fontFamily: 'var(--mono)' }}>delinc</code> ya están cargadas.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {EJEMPLOS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setCodigo(e.codigo)}
              className="rounded-lg border-2 border-line bg-surface px-3 py-2 text-sm font-bold text-ink"
            >
              {e.nombre}
            </button>
          ))}
        </div>

        <div className="card-play mt-5 p-6">
          <label htmlFor="preview-probar-codigo" className="mb-3 block text-xs font-bold uppercase tracking-widest text-muted">
            Tu Codigo
          </label>
          <div className="editor-probar mb-4">
            <textarea
              id="preview-probar-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              rows={8}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              placeholder="Escribe tu codigo aqui..."
              className="input-field resize-none font-mono text-[15px] leading-relaxed"
            />
            <ProbarCodigo config={CONFIG} codigo={codigo} onPrueba={() => setPruebas((n) => n + 1)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-muted">{codigo.length} caracteres</span>
            <button type="button" disabled className="primary-button flex items-center gap-2">
              <Send className="h-4 w-4" />
              Enviar Respuesta
            </button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm font-medium text-ink-soft">
          <dt className="text-muted">Estado de R</dt>
          <dd id="preview-probar-estado">{estado}</dd>
          <dt className="text-muted">Carga</dt>
          <dd id="preview-probar-carga">
            {motorR.msCarga === null ? '—' : `${(motorR.msCarga / 1000).toFixed(1)} s`}
          </dd>
          <dt className="text-muted">Pruebas</dt>
          <dd id="preview-probar-pruebas">{pruebas}</dd>
          {motorR.error && (
            <>
              <dt className="text-muted">Error</dt>
              <dd>{motorR.error}</dd>
            </>
          )}
        </dl>
      </div>
    </div>
  );
}
