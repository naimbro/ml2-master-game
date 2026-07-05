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
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneCalled = useRef(false);

  useEffect(() => {
    if (stage !== 'montage') return;
    if (timer.current) return;
    if (cursor >= duels.length) {
      if (finalReady) setStage('climax');
      return;
    }
    const d = duels[cursor];
    setCurrent(d); setVerdict(false);
    const hold = d.isUpset ? 1200 : 260;
    timer.current = setTimeout(() => {
      setVerdict(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        setCursor((c) => c + 1);
      }, d.isUpset ? 620 : 160);
    }, hold);
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  }, [stage, cursor, duels, finalReady]);

  useEffect(() => {
    if (stage !== 'climax') return;
    const climax = duels.find((d) => d.isClimax) || [...duels].reverse().find((d) => d.isUpset) || null;
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
  const gap = Math.abs(d.a.provScore - d.b.provScore);
  return (
    <div className={`rr-duel ${climax ? 'rr-climax' : ''}`}>
      {climax && <div className="rr-climax-tag">◆ El duelo de la ronda ◆</div>}
      <div className={`rr-panel a ${verdict && winnerSide === 'a' ? 'win' : verdict ? 'lose' : ''}`}>
        <div className="rr-side">Contendiente A</div>
        <div className="rr-seed">SEED #{d.a.provRank}</div>
        <div className="rr-name">{d.a.name}</div>
        <div className="rr-sc">provisional <b>{d.a.provScore}</b></div>
      </div>
      <div className={`rr-panel b ${verdict && winnerSide === 'b' ? 'win' : verdict ? 'lose' : ''}`}>
        <div className="rr-side">Contendiente B</div>
        <div className="rr-seed">SEED #{d.b.provRank}</div>
        <div className="rr-name">{d.b.name}</div>
        <div className="rr-sc">provisional <b>{d.b.provScore}</b></div>
      </div>
      {!verdict && <div className="rr-vs">VS</div>}
      {!verdict && <div className="rr-gap">{gap <= 1 ? `Empate técnico · Δ${gap}` : `Rivales parejos · Δ${gap}`}</div>}
      {verdict && winnerSide !== 'tie' && (
        <div className={`rr-verdict ${winnerSide}`}>
          <span className="rr-g">Gana {(winnerSide === 'a' ? d.a.name : d.b.name).split(' ')[0]}</span>
          {d.isUpset && <span className="rr-up">◆ Sorpresa ◆</span>}
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
.rr-stage{position:fixed;inset:0;z-index:50;overflow:hidden;color:#eef1f6;font-family:ui-monospace,Menlo,Consolas,monospace;
  background:radial-gradient(120% 90% at 50% -10%,#121626 0%,#07080d 60%,#04040a 100%);display:flex;flex-direction:column}
.rr-vignette{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 220px 40px rgba(0,0,0,.85)}
.rr-hud{display:flex;justify-content:space-between;align-items:flex-end;padding:22px clamp(16px,4vw,54px) 0;z-index:2}
.rr-tag{font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#ff5a3c;display:inline-flex;align-items:center;gap:8px}
.rr-dot{width:7px;height:7px;border-radius:50%;background:#ff5a3c;box-shadow:0 0 10px #ff5a3c;animation:rrp 1s infinite}
@keyframes rrp{50%{opacity:.25}}
.rr-count{font-family:Impact,'Arial Narrow Bold',sans-serif;font-size:clamp(28px,5vw,54px);line-height:.82;text-align:right}
.rr-count em{color:#ffc24b;font-style:normal}.rr-count small{display:block;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.28em;color:#727a90;margin-top:6px}
.rr-progress{height:3px;margin:16px clamp(16px,4vw,54px) 0;background:#1c2130;position:relative;overflow:hidden;z-index:2}
.rr-progress i{position:absolute;inset:0 100% 0 0;background:linear-gradient(90deg,#38e1ff,#ffc24b);box-shadow:0 0 14px #ffc24b;transition:right .4s}
.rr-arena{flex:1;display:grid;place-items:center;padding:14px;z-index:2}
.rr-idle{color:#727a90;letter-spacing:.2em;text-transform:uppercase;font-size:13px}
.rr-buscando{animation:rrp 1s infinite}
.rr-duel{position:relative;width:min(1040px,94vw);aspect-ratio:16/8;display:grid;grid-template-columns:1fr 1fr;animation:rrIn .22s ease-out}
@keyframes rrIn{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}
.rr-climax{outline:2px solid #ffc24b;outline-offset:6px}
.rr-climax-tag{position:absolute;top:-34px;left:50%;transform:translateX(-50%);font-size:12px;letter-spacing:.3em;color:#ffc24b;text-transform:uppercase}
.rr-panel{position:relative;padding:clamp(16px,3vw,40px);display:flex;flex-direction:column;justify-content:center;gap:12px;background:#0e1017;border:1px solid #1c2130;overflow:hidden;transition:.45s}
.rr-panel.a{clip-path:polygon(0 0,100% 0,88% 100%,0 100%);box-shadow:inset 6px 0 0 -2px #38e1ff}
.rr-panel.b{clip-path:polygon(12% 0,100% 0,100% 100%,0 100%);text-align:right;align-items:flex-end;box-shadow:inset -6px 0 0 -2px #ff5a3c}
.rr-side{font-size:11px;letter-spacing:.3em;text-transform:uppercase}.rr-panel.a .rr-side{color:#38e1ff}.rr-panel.b .rr-side{color:#ff5a3c}
.rr-seed{font-size:13px;color:#727a90;letter-spacing:.1em}
.rr-name{font-family:Impact,'Arial Narrow Bold',sans-serif;font-size:clamp(24px,5vw,60px);line-height:.9;text-transform:uppercase}
.rr-sc{font-size:14px;color:#727a90}.rr-sc b{color:#eef1f6;font-size:20px}
.rr-panel.win.a{background:linear-gradient(100deg,rgba(56,225,255,.16),#0e1017);box-shadow:inset 8px 0 0 -2px #38e1ff,0 0 60px -8px rgba(56,225,255,.6)}
.rr-panel.win.b{background:linear-gradient(260deg,rgba(255,90,60,.16),#0e1017);box-shadow:inset -8px 0 0 -2px #ff5a3c,0 0 60px -8px rgba(255,90,60,.6)}
.rr-panel.lose{filter:grayscale(.85) brightness(.5);transform:scale(.97)}
.rr-vs{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:Impact,sans-serif;font-size:clamp(32px,6vw,74px);
  color:#07080d;-webkit-text-stroke:2px #ffc24b;background:#07080d;border:2px solid #ffc24b;border-radius:50%;width:clamp(60px,9vw,110px);aspect-ratio:1;display:grid;place-items:center;text-shadow:0 0 26px rgba(255,194,75,.6)}
.rr-gap{position:absolute;top:calc(50% + clamp(42px,6vw,70px));left:50%;transform:translateX(-50%);font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:#ffc24b;white-space:nowrap}
.rr-verdict{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-9deg);padding:10px 30px;border:3px solid #ffc24b;background:rgba(7,8,13,.72);text-align:center;font-family:Impact,sans-serif;text-transform:uppercase;animation:rrStamp .34s cubic-bezier(.2,1.4,.3,1)}
.rr-verdict.a{border-color:#38e1ff;color:#38e1ff}.rr-verdict.b{border-color:#ff5a3c;color:#ff5a3c}
@keyframes rrStamp{from{opacity:0;transform:translate(-50%,-50%) rotate(-9deg) scale(.4)}to{opacity:1;transform:translate(-50%,-50%) rotate(-9deg) scale(1)}}
.rr-g{font-size:clamp(28px,5vw,58px);line-height:.9;display:block}
.rr-up{display:block;font-family:ui-monospace,monospace;font-size:12px;letter-spacing:.4em;color:#ff5a3c;margin-top:8px}
.rr-board{width:min(680px,92vw)}
.rr-board h2{font-family:Impact,sans-serif;text-transform:uppercase;font-size:clamp(24px,4vw,42px);text-align:center;margin:0}
.rr-sub{text-align:center;color:#727a90;font-size:12px;letter-spacing:.26em;text-transform:uppercase;margin:4px 0 20px}
.rr-row{display:grid;grid-template-columns:44px 1fr auto auto;align-items:center;gap:14px;padding:0 16px;height:50px;background:#0e1017;border:1px solid #1c2130;margin-bottom:6px;animation:rrIn .4s ease-out}
.rr-rk{font-family:Impact,sans-serif;font-size:24px;color:#727a90;text-align:center}.rr-row.top1 .rr-rk{color:#ffc24b}
.rr-nm{font-family:Impact,sans-serif;font-size:19px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rr-delta{font-size:13px;min-width:48px;text-align:right}.rr-delta.up{color:#ffc24b}.rr-delta.down{color:#ff5a3c}.rr-delta.zero{color:#727a90}
.rr-score{font-size:20px;font-weight:600;min-width:42px;text-align:right;font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:reduce){.rr-duel,.rr-row,.rr-verdict{animation-duration:.01ms}}
`;
