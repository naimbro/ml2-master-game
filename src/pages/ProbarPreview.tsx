import { useState } from 'react';
import { Send } from 'lucide-react';
import ProbarCodigo from '../components/ProbarCodigo';
import { useMotorR } from '../hooks/useMotorR';
import { motorR, type ConfigR } from '../lib/rEnVivo';

// El hermano de MCRepartoPreview y CompasPreview, para lo unico de R en vivo
// que ningun test puede decir: si webR carga en ESTE telefono, cuanto tarda, y
// como se ve la tira de «Probar» con un grafico de verdad debajo.
//
// Sin login y sin juego: se abre por /preview-probar desde cualquier telefono.
// El contenido NO es inventado: es la ronda 1 de la clase 8 de dataviz
// (`curso`, 33 personas) con sus errores reales de la rubrica.

const CONFIG: ConfigR = {
  packages: ['ggplot2', 'dplyr'],
  files: [{ name: 'encuesta_curso.csv', src: 'datos/dataviz/encuesta_curso.csv' }],
  setup: 'curso <- read.csv("encuesta_curso.csv")',
};

const EJEMPLOS: { id: string; nombre: string; codigo: string }[] = [
  { id: 'bien', nombre: 'La del cuaderno', codigo: 'ggplot(curso, aes(x = transporte)) +\n  geom_bar()' },
  { id: 'pipe', nombre: '%>% en vez de +', codigo: 'ggplot(curso, aes(x = transporte)) %>%\n  geom_bar()' },
  { id: 'mayuscula', nombre: 'Transporte con mayúscula', codigo: 'ggplot(curso, aes(x = Transporte)) +\n  geom_bar()' },
  { id: 'comillas', nombre: 'Corre y contesta mal', codigo: 'ggplot(curso, aes(x = "transporte")) +\n  geom_bar()' },
  { id: 'tabla', nombre: 'Sólo la tabla', codigo: 'curso %>% count(transporte)' },
];

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
          Dataviz, clase 8, ronda 1: el gráfico de barras que muestra cuántas personas usan cada{' '}
          <code style={{ fontFamily: 'var(--mono)' }}>transporte</code>. La tabla{' '}
          <code style={{ fontFamily: 'var(--mono)' }}>curso</code> ya está cargada.
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
