import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { toggleMute, getMuted, initAudio } from '../lib/sounds';

export default function SoundToggle() {
  const [muted, setMuted] = useState(getMuted());

  const handleToggle = () => {
    initAudio();
    const newMuted = toggleMute();
    setMuted(newMuted);
  };

  return (
    <button
      onClick={handleToggle}
      className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-surface-2 hover:bg-surface-3 flex items-center justify-center transition-all border border-line"
      title={muted ? 'Activar sonido' : 'Silenciar'}
    >
      {muted ? (
        <VolumeX className="w-4 h-4 text-muted" />
      ) : (
        <Volume2 className="w-4 h-4 text-ink-soft" />
      )}
    </button>
  );
}
