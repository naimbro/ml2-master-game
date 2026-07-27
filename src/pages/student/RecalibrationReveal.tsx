import { useEffect, useRef, useState } from 'react';
import type { RoundDuel } from '../../types/game';

interface FinalRow { playerId: string; playerName: string; score: number; rank: number; provScore?: number; provRank?: number; }

interface Props {
  duels: RoundDuel[];
  duelTotal: number;
  finalReady: boolean;
  finalRankings: FinalRow[];
  onDone: () => void;
}

type Stage = 'montage' | 'climax' | 'board';

export default function RecalibrationReveal({ duels, duelTotal, finalReady, finalRankings, onDone }: Props) {
  const [cursor, setCursor] = useState(0);
  const [current, setCurrent] = useState<RoundDuel | null>(null);
  const [verdict, setVerdict] = useState(false);
  const [stage, setStage] = useState<Stage>('montage');
  const doneCalled = useRef(false);
  // Live state via refs so newly-streamed duels never restart the current card.
  const duelsRef = useRef(duels);
  duelsRef.current = duels;
  const finalReadyRef = useRef(finalReady);
  finalReadyRef.current = finalReady;
  const cursorRef = useRef(0);

  // Montage driver: a self-scheduling loop keyed ONLY on `stage`, so it does not
  // re-run (and restart the current duel) each time a new duel snapshot arrives.
  useEffect(() => {
    if (stage !== 'montage') return;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const playNext = () => {
      if (cancelled) return;
      const ds = duelsRef.current;
      const c = cursorRef.current;
      if (c >= ds.length) {
        if (finalReadyRef.current) { setStage('climax'); return; }
        t = setTimeout(playNext, 250); // caught up; wait for more duels to stream in
        return;
      }
      const d = ds[c];
      setCurrent(d); setVerdict(false);
      // Un empate a 160ms es un parpadeo. Le damos ~800ms totales: menos que un
      // upset (1820ms), más que un duelo resuelto (420ms).
      const isTie = d.winner === 'tie';
      const hold = d.isUpset ? 1200 : isTie ? 420 : 260;
      const after = d.isUpset ? 620 : isTie ? 380 : 160;
      t = setTimeout(() => {
        if (cancelled) return;
        setVerdict(true);
        t = setTimeout(() => {
          if (cancelled) return;
          cursorRef.current = c + 1;
          setCursor(c + 1);
          playNext();
        }, after);
      }, hold);
    };
    playNext();
    return () => { cancelled = true; clearTimeout(t); };
  }, [stage]);

  useEffect(() => {
    if (stage !== 'climax') return;
    // Prefer the flagged climax, else the last upset, else just the last duel — so
    // even a tiny round (e.g. a 2-account test, one non-upset duel) still lingers on
    // a card instead of only flashing past.
    const climax = duels.find((d) => d.isClimax) || [...duels].reverse().find((d) => d.isUpset) || duels[duels.length - 1] || null;
    if (!climax) { setStage('board'); return; }
    setCurrent(climax); setVerdict(false);
    const t1 = setTimeout(() => setVerdict(true), 1400);
    const t2 = setTimeout(() => setStage('board'), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [stage, duels]);

  useEffect(() => {
    if (stage !== 'board') return;
    const t = setTimeout(() => { if (!doneCalled.current) { doneCalled.current = true; onDone(); } }, 3200);
    return () => clearTimeout(t);
  }, [stage, onDone]);

  const played = Math.min(cursor, duelTotal || duels.length);
  const buscando = stage === 'montage' && cursor >= duels.length && !finalReady;

  return (
    <div className="rr-stage">
      <style>{RR_CSS}</style>
      <div className="rr-vignette" />
      <div className="rr-hud">
        <div className="rr-tag"><span className="rr-dot" /> Recalibrando · combate directo</div>
        <div className="rr-count">{String(played).padStart(2, '0')}<em> / </em>{duelTotal || duels.length}
          <small>duelos · solo rivales parejos</small></div>
      </div>
      <div className="rr-progress"><i style={{ right: `${100 - (duelTotal ? (played / duelTotal) * 100 : 0)}%` }} /></div>

      <div className="rr-arena">
        {stage === 'board' ? (
          <Board rankings={finalRankings} />
        ) : current ? (
          <Duel d={current} verdict={verdict} climax={stage === 'climax'} />
        ) : (
          <div className="rr-idle">Preparando duelos…</div>
        )}
        {buscando && <div className="rr-idle rr-buscando">buscando duelos…</div>}
      </div>
    </div>
  );
}

function Duel({ d, verdict, climax }: { d: RoundDuel; verdict: boolean; climax: boolean }) {
  const winnerSide = d.winner;
  const isTie = winnerSide === 'tie';
  const gap = Math.abs(d.a.provScore - d.b.provScore);
  // Con veredicto: el ganador queda 'win' y el perdedor 'lose'. En un empate no hay
  // perdedor, así que los dos van a un estado propio ('tie'), nunca a 'lose'.
  const panel = (side: 'a' | 'b') => {
    if (!verdict) return '';
    if (isTie) return 'tie';
    return winnerSide === side ? 'win' : 'lose';
  };
  return (
    <div className={`rr-duel ${climax ? 'rr-climax' : ''}`}>
      {climax && <div className="rr-climax-tag">◆ El duelo de la ronda ◆</div>}
      <div className={`rr-panel a ${panel('a')}`}>
        <div className="rr-side">Contendiente A</div>
        <div className="rr-seed">SEED #{d.a.provRank}</div>
        <div className="rr-name">{d.a.name}</div>
        <div className="rr-sc">provisional <b>{d.a.provScore}</b></div>
      </div>
      <div className={`rr-panel b ${panel('b')}`}>
        <div className="rr-side">Contendiente B</div>
        <div className="rr-seed">SEED #{d.b.provRank}</div>
        <div className="rr-name">{d.b.name}</div>
        <div className="rr-sc">provisional <b>{d.b.provScore}</b></div>
      </div>
      {!verdict && <div className="rr-vs">VS</div>}
      {!verdict && <div className="rr-gap">{gap <= 1 ? `Empate técnico · Δ${gap}` : `Rivales parejos · Δ${gap}`}</div>}
      {verdict && !isTie && (
        <div className={`rr-verdict ${winnerSide}`}>
          <span className="rr-g">Gana {(winnerSide === 'a' ? d.a.name : d.b.name).split(' ')[0]}</span>
          {d.isUpset && <span className="rr-up">◆ Sorpresa ◆</span>}
        </div>
      )}
      {verdict && isTie && (
        <div className="rr-verdict tie">
          <span className="rr-g">Empate</span>
          <span className="rr-up">ninguno se impuso</span>
        </div>
      )}
    </div>
  );
}

function Board({ rankings }: { rankings: FinalRow[] }) {
  const rows = [...rankings].sort((a, b) => a.rank - b.rank);
  return (
    <div className="rr-board">
      <h2>Tabla recalibrada</h2>
      <div className="rr-sub">pequeñas victorias, grandes movimientos</div>
      {rows.map((r) => {
        const d = (r.provRank ?? r.rank) - r.rank;
        return (
          <div key={r.playerId} className={`rr-row ${r.rank === 1 ? 'top1' : ''}`}>
            <div className="rr-rk">{r.rank}</div>
            <div className="rr-nm">{r.playerName}</div>
            <div className={`rr-delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'zero'}`}>{d > 0 ? `▲ ${d}` : d < 0 ? `▼ ${-d}` : '—'}</div>
            <CountUp from={r.provScore ?? r.score} to={r.score} />
          </div>
        );
      })}
    </div>
  );
}

function CountUp({ from, to }: { from: number; to: number }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <div className="rr-score">{v}</div>;
}

const RR_CSS = `
/* Piel del reveal: papel, tinta, sombras duras. El montaje nacio como un afiche de
   boxeo (negro puro, Impact, cian neon) y nada de eso existia en el resto de la app,
   que desde el 26-07-2026 es "Cancha". La estructura que hace el drama se queda —dos
   paneles enfrentados, el VS, el sello, la sorpresa en camara lenta—; el drama sale
   ahora del tamano, la inclinacion y la sombra dura, no del neon. */
.rr-stage{
  --rr-bg:radial-gradient(120% 90% at 50% -10%,#FFFFFF 0%,#FAFAF8 55%,#F2F1ED 100%);
  --rr-vignette:inset 0 0 200px 30px rgba(16,17,20,.10);
  --rr-panel:#FFFFFF; --rr-line:#101114; --rr-border:2.5px;
  --rr-ink:#101114; --rr-dim:#5F6269;
  --rr-a:#C2400F; --rr-b:#FF5A1F; --rr-accent:#C2400F;
  --rr-display:'Archivo Black','Outfit',system-ui,sans-serif;
  --rr-label:'Outfit',system-ui,sans-serif;
  --rr-radius:16px; --rr-panel-shadow:4px 4px 0 var(--rr-line);
  --rr-win-a:#FFFFFF; --rr-win-b:#FFFFFF;
  --rr-win-glow-a:7px 7px 0 #F5A524; --rr-win-glow-b:7px 7px 0 #FF5A1F;
  --rr-lose:saturate(.1) brightness(.97) opacity(.55);
  --rr-stamp-bg:#F5A524; --rr-stamp-border:2.5px;
  --rr-vs-bg:#FFFFFF; --rr-vs-ink:#101114;
}
.rr-stage{position:fixed;inset:0;z-index:50;overflow:hidden;color:var(--rr-ink);font-family:var(--rr-label);
  background:var(--rr-bg);display:flex;flex-direction:column}
.rr-vignette{position:absolute;inset:0;pointer-events:none;box-shadow:var(--rr-vignette)}
.rr-hud{display:flex;justify-content:space-between;align-items:flex-end;padding:22px clamp(16px,4vw,54px) 0;z-index:2}
.rr-tag{font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:var(--rr-b);display:inline-flex;align-items:center;gap:8px;font-weight:700}
.rr-dot{width:7px;height:7px;border-radius:50%;background:var(--rr-b);animation:rrp 1s infinite}
@keyframes rrp{50%{opacity:.25}}
.rr-count{color:var(--rr-ink);font-family:var(--rr-display);font-size:clamp(28px,5vw,54px);line-height:.82;text-align:right}
.rr-count em{color:var(--rr-accent);font-style:normal}.rr-count small{display:block;font-family:var(--rr-label);font-size:11px;letter-spacing:.28em;color:var(--rr-dim);margin-top:6px;font-weight:600}
.rr-progress{height:3px;margin:16px clamp(16px,4vw,54px) 0;background:var(--rr-line);position:relative;overflow:hidden;z-index:2}
.rr-progress i{position:absolute;inset:0 100% 0 0;background:linear-gradient(90deg,var(--rr-a),var(--rr-accent));transition:right .4s}
.rr-arena{flex:1;display:grid;place-items:center;padding:14px;z-index:2}
.rr-idle{color:var(--rr-dim);letter-spacing:.2em;text-transform:uppercase;font-size:13px;font-weight:600}
.rr-buscando{animation:rrp 1s infinite}
.rr-duel{position:relative;width:min(1040px,94vw);aspect-ratio:16/8;display:grid;grid-template-columns:1fr 1fr;animation:rrIn .22s ease-out}
@keyframes rrIn{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}
.rr-climax{outline:2px solid var(--rr-accent);outline-offset:6px}
.rr-climax-tag{position:absolute;top:-34px;left:50%;transform:translateX(-50%);font-size:12px;letter-spacing:.3em;color:var(--rr-accent);text-transform:uppercase;font-weight:700}
.rr-panel{position:relative;padding:clamp(16px,3vw,40px);display:flex;flex-direction:column;justify-content:center;gap:12px;
  background:var(--rr-panel);border:var(--rr-border) solid var(--rr-line);border-radius:var(--rr-radius);box-shadow:var(--rr-panel-shadow);overflow:hidden;transition:.45s}
.rr-panel.a{clip-path:polygon(0 0,100% 0,88% 100%,0 100%)}
.rr-panel.b{clip-path:polygon(12% 0,100% 0,100% 100%,0 100%);text-align:right;align-items:flex-end}
.rr-side{font-size:11px;letter-spacing:.3em;text-transform:uppercase;font-weight:700}
.rr-panel.a .rr-side{color:var(--rr-a)}.rr-panel.b .rr-side{color:var(--rr-b)}
.rr-seed{font-size:13px;color:var(--rr-dim);letter-spacing:.1em;font-weight:600}
.rr-name{font-family:var(--rr-display);font-size:clamp(24px,5vw,60px);line-height:.9;text-transform:uppercase}
.rr-sc{font-size:14px;color:var(--rr-dim);font-weight:600}.rr-sc b{color:var(--rr-ink);font-size:20px}
.rr-panel.win.a{background:var(--rr-win-a);box-shadow:var(--rr-win-glow-a)}
.rr-panel.win.b{background:var(--rr-win-b);box-shadow:var(--rr-win-glow-b)}
.rr-panel.lose{filter:var(--rr-lose);transform:scale(.97)}
.rr-panel.tie{filter:saturate(.65) brightness(.9)}
.rr-vs{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:var(--rr-display);font-size:clamp(30px,5.4vw,66px);
  color:var(--rr-vs-ink);-webkit-text-stroke:2px var(--rr-accent);background:var(--rr-vs-bg);border:2.5px solid var(--rr-accent);border-radius:50%;
  width:clamp(60px,9vw,110px);aspect-ratio:1;display:grid;place-items:center}
.rr-gap{position:absolute;top:calc(50% + clamp(42px,6vw,70px));left:50%;transform:translateX(-50%);font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--rr-accent);white-space:nowrap;font-weight:700}
.rr-verdict{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-9deg);padding:10px 30px;
  border:var(--rr-stamp-border) solid var(--rr-accent);background:var(--rr-stamp-bg);text-align:center;font-family:var(--rr-display);text-transform:uppercase;
  animation:rrStamp .34s cubic-bezier(.2,1.4,.3,1)}
.rr-verdict.a{border-color:var(--rr-a);color:var(--rr-a)}.rr-verdict.b{border-color:var(--rr-b);color:var(--rr-b)}
.rr-verdict.tie{border-color:var(--rr-accent);color:var(--rr-accent)}
/* El sello va sobre ambar: el texto es tinta, no ambar sobre ambar. */
.rr-verdict,.rr-verdict.a,.rr-verdict.b,.rr-verdict.tie{color:var(--rr-ink)}
@keyframes rrStamp{from{opacity:0;transform:translate(-50%,-50%) rotate(-9deg) scale(.4)}to{opacity:1;transform:translate(-50%,-50%) rotate(-9deg) scale(1)}}
.rr-g{font-size:clamp(28px,5vw,58px);line-height:.9;display:block}
.rr-up{display:block;font-family:var(--rr-label);font-size:12px;letter-spacing:.4em;color:var(--rr-b);margin-top:8px;font-weight:700}
.rr-board{width:min(680px,92vw)}
.rr-board h2{color:var(--rr-ink);font-family:var(--rr-display);text-transform:uppercase;font-size:clamp(24px,4vw,42px);text-align:center;margin:0}
.rr-sub{text-align:center;color:var(--rr-dim);font-size:12px;letter-spacing:.26em;text-transform:uppercase;margin:4px 0 20px;font-weight:600}
.rr-row{display:grid;grid-template-columns:44px 1fr auto auto;align-items:center;gap:14px;padding:0 16px;height:50px;
  background:var(--rr-panel);border:var(--rr-border) solid var(--rr-line);border-radius:calc(var(--rr-radius) / 2);margin-bottom:6px;animation:rrIn .4s ease-out}
.rr-rk{font-family:var(--rr-display);font-size:24px;color:var(--rr-dim);text-align:center}.rr-row.top1 .rr-rk{color:var(--rr-accent)}
.rr-nm{font-family:var(--rr-display);font-size:19px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rr-delta{font-size:13px;min-width:48px;text-align:right;font-weight:700}.rr-delta.up{color:var(--rr-accent)}.rr-delta.down{color:var(--rr-b)}.rr-delta.zero{color:var(--rr-dim)}
.rr-score{font-size:20px;font-weight:600;min-width:42px;text-align:right;font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:reduce){.rr-duel,.rr-row,.rr-verdict{animation-duration:.01ms}}
`;
