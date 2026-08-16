import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import CompasPlano, { type PuntoCompas } from '../../components/compas/CompasPlano';
import TiraAgencia, { type PuntoAgencia } from '../../components/compas/TiraAgencia';
import { useCompasRun } from '../../hooks/useCompasRun';
import { colorAgencia, cuantosRespondieron } from '../../lib/compas';
import { currentCompasUrl } from '../../lib/joinUrl';

const ARCHIVO = { fontFamily: "'Archivo Black', sans-serif" } as const;

/**
 * The host screen. This is what the projector shows, so two rules hold:
 * no names anywhere on the cloud, and nothing that reveals what any one person
 * answered. Each student recognises their own point; nobody recognises anyone
 * else's.
 *
 * Antes de empezar, la pantalla ENTERA es la puerta de entrada. No es una
 * decision estetica: en el item 0 el plano esta vacio —nadie ha respondido
 * nada— y ese es justo el minuto en que treinta personas estan buscando como
 * entrar. Lo que habia antes era el texto "Entren en /compas/ABC123", que no es
 * una direccion que nadie pueda escribir: le falta el dominio y le falta el
 * prefijo /ml2-master-game/. Al arrancar se repliega a la franja de arriba, que
 * se queda toda la sesion para el que llega tarde.
 */
export default function CompasSala() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const {
    run,
    pack,
    loading,
    error,
    isHost,
    respuestas,
    avanzar,
    retroceder,
    cerrar,
    posicionesDelCurso,
    posicionesPrevias,
  } = useCompasRun(code);

  if (loading) return <div className="p-8 text-ink-soft">Cargando…</div>;
  if (error || !run || !pack) return <div className="p-8 text-ink-soft">{error ?? 'No existe ese compás'}</div>;
  if (!isHost) return <div className="p-8 text-ink-soft">Esta pantalla es del anfitrión.</div>;

  const { instrumento, arquetipos } = pack;
  const bandasAgencia = arquetipos.bandasAgencia?.bandas;
  const item = run.itemIndex > 0 ? instrumento.items[run.itemIndex - 1] : null;
  const previas = posicionesPrevias();
  const delCurso = posicionesDelCurso();
  const puntos: PuntoCompas[] = delCurso.map((p) => ({
    id: p.id,
    pos: { magnitud: p.pos.magnitud, direccion: p.pos.direccion },
    previa: previas[p.id]
      ? { magnitud: previas[p.id].magnitud, direccion: previas[p.id].direccion }
      : null,
    // El tercer eje va en el color del punto y no en una tercera coordenada:
    // nueve celdas por cinco bandas serian cuarenta y cinco casillas para
    // veinticinco personas. Quien todavia no ha respondido nada del eje viene
    // en null y se pinta con la tinta de siempre.
    color: colorAgencia(p.pos.agencia, bandasAgencia),
  }));
  const puntosAgencia: PuntoAgencia[] = delCurso.map((p) => ({
    id: p.id,
    agencia: p.pos.agencia,
  }));

  const inscritos = Object.keys(run.participantes ?? {}).length;
  // Sobre el item que esta en pantalla, no sobre cuantas respuestas lleva cada
  // uno: saltarse un item es legitimo aca, y contando cuentas el que se salto
  // uno quedaba atrasado para siempre. Ver `cuantosRespondieron`.
  const respondieron = cuantosRespondieron(respuestas, item?.id);

  // La URL completa, no la ruta. Un alumno leyendo "/compas/37NBPZ" en el
  // proyector tendria que adivinar el dominio Y el prefijo de GitHub Pages.
  const url = currentCompasUrl(run.code);
  const urlVisible = url.replace(/^https?:\/\//, '');

  const enPortada = run.itemIndex === 0;

  if (enPortada) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <div className="mb-6 flex flex-wrap items-baseline gap-4">
          <h1 className="text-3xl uppercase leading-none" style={ARCHIVO}>
            {instrumento.title}
          </h1>
          <span className="tabular-nums text-ink-soft">{inscritos} conectados</span>
        </div>

        <div className="grid flex-1 items-center gap-8 sm:grid-cols-[minmax(0,34%)_1fr]">
          <div className="border-2 border-ink bg-surface p-3 [&>svg]:h-auto [&>svg]:w-full">
            <QRCodeSVG value={url} size={512} level="M" marginSize={0} />
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-lg uppercase tracking-wider text-ink" style={ARCHIVO}>
              Escanea, o entra en
            </p>
            <p className="break-all text-2xl text-ink">{urlVisible}</p>
            <p
              className="border-2 border-ink bg-kahoot-yellow px-6 py-4 text-center text-6xl tabular-nums tracking-[0.14em] text-ink shadow-[6px_6px_0_#101114] sm:text-7xl"
              style={ARCHIVO}
            >
              {run.code}
            </p>
            <p className="text-ink-soft">No hay respuestas correctas y esto no lleva nota.</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={avanzar}
            className="border-2 border-ink bg-kahoot-orange px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            style={ARCHIVO}
          >
            Empezar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h1 className="text-3xl uppercase leading-none" style={ARCHIVO}>
          {instrumento.title}
        </h1>
        <span
          className="border-2 border-ink bg-kahoot-yellow px-3 py-1 text-2xl tabular-nums tracking-widest text-ink"
          style={ARCHIVO}
        >
          {run.code}
        </span>
        <span className="tabular-nums text-ink-soft">
          {respondieron} de {inscritos} han respondido · ítem {run.itemIndex} de {run.totalItems}
        </span>

        {/* Se queda toda la sesion: el que llega en el item 6 tambien entra. */}
        <span className="ml-auto flex items-center gap-3">
          <span className="hidden break-all text-sm text-ink-soft sm:inline">{urlVisible}</span>
          <span className="w-[74px] border-2 border-ink bg-surface p-1 [&>svg]:h-auto [&>svg]:w-full">
            <QRCodeSVG value={url} size={512} level="M" marginSize={0} />
          </span>
        </span>
      </div>

      {item && (
        <div className="mb-4 border-l-4 border-ink bg-surface px-4 py-3">
          <p className="text-xl text-ink">{item.question}</p>
          {/*
            Seis de los doce items alimentan el tercer eje y seis no. Sin decirlo,
            la tira vacia en el item 1 se lee desde la sala como que algo fallo.
          */}
          {instrumento.ejeAgencia && (
            <p className="mt-2 text-[12px] uppercase tracking-wide text-faint" style={ARCHIVO}>
              {item.options.some((o) => typeof o.agencia === 'number')
                ? '↓ este ítem también mueve la tira de abajo'
                : '↓ este ítem no pregunta por quién conduce: la tira no se mueve'}
            </p>
          )}
        </div>
      )}

      <div className="mb-4 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
        <CompasPlano puntos={puntos} ejeX={instrumento.axes.x} ejeY={instrumento.axes.y} />
      </div>

      {instrumento.ejeAgencia && bandasAgencia && (
        <div className="mb-5 border-2 border-ink bg-surface p-4 shadow-[4px_4px_0_#101114]">
          <TiraAgencia
            puntos={puntosAgencia}
            eje={instrumento.ejeAgencia}
            bandas={bandasAgencia}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={avanzar}
          disabled={run.itemIndex >= run.totalItems}
          className="border-2 border-ink bg-kahoot-orange px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] disabled:opacity-40 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          style={ARCHIVO}
        >
          Siguiente ítem
        </button>
        <button
          type="button"
          onClick={retroceder}
          disabled={run.itemIndex <= 1}
          className="border-2 border-ink bg-surface px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114] disabled:opacity-40"
          style={ARCHIVO}
        >
          Volver
        </button>
        {/*
          Un solo boton. Eran dos --"armar campos" y "cerrar"-- y en la sala
          eso es una decision que nadie quiere tomar con el curso mirando: los
          campos se arman con las posiciones finales, asi que cerrar SIEMPRE va
          antes. Separarlos solo ofrecia la forma de hacerlo mal.
        */}
        <button
          type="button"
          onClick={async () => {
            if (run.status !== 'finished') await cerrar();
            navigate(`/compas/${run.code}/campos`);
          }}
          className="border-2 border-ink bg-surface px-5 py-3 text-sm uppercase text-ink shadow-[3px_3px_0_#101114]"
          style={ARCHIVO}
        >
          {run.status === 'finished' ? 'Ver campos' : 'Cerrar y armar campos'}
        </button>
      </div>
    </div>
  );
}
