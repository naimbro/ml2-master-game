import { useState, useRef, useEffect } from 'react';
import { Music } from 'lucide-react';
import { switchMusic, getCurrentMusicStyle, MUSIC_OPTIONS, type MusicStyle } from '../lib/sounds';

export default function MusicSelector() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MusicStyle>(getCurrentMusicStyle());
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (style: MusicStyle) => {
    setSelected(style);
    switchMusic(style);
    setOpen(false);
  };

  const currentName = MUSIC_OPTIONS.find(o => o.id === selected)?.name || 'Musica';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-sm transition-all"
      >
        <Music className="w-4 h-4" />
        <span className="hidden sm:inline">{currentName}</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 right-0 w-48 bg-[#1a0a3e] border-2 border-white/15 rounded-xl shadow-2xl overflow-hidden z-50">
          {MUSIC_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors ${
                selected === opt.id
                  ? 'bg-kahoot-green/20 text-kahoot-green'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {selected === opt.id && <span className="mr-2">&#9679;</span>}
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
