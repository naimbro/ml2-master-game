import { useState } from 'react';
import { ImageOff, Music } from 'lucide-react';
import type { MediaAsset } from '../types/game';
import { stopBackgroundMusic } from '../lib/sounds';
import { resolveMediaSrc } from '../lib/media';

function MediaImage({ asset, className }: { asset: MediaAsset; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center gap-3 p-4 bg-surface-2 border-2 border-dashed border-line rounded-xl ${className ?? ''}`}
        role="img"
        aria-label={asset.alt || 'Imagen no disponible'}
      >
        <ImageOff className="w-6 h-6 text-faint shrink-0" />
        <span className="text-muted text-sm font-medium">
          {asset.alt || 'Imagen no disponible'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolveMediaSrc(asset.src)}
      alt={asset.alt || ''}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`media-frame max-w-full w-auto max-h-[38vh] mx-auto block object-contain ${className ?? ''}`}
    />
  );
}

function MediaAudio({ asset }: { asset: MediaAsset }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex items-center gap-3 p-4 bg-surface-2 border-2 border-dashed border-line rounded-xl">
        <Music className="w-6 h-6 text-faint shrink-0" />
        <span className="text-muted text-sm font-medium">
          {asset.alt || 'Audio no disponible'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {asset.alt && (
        <div className="flex items-center gap-2 text-ink-soft text-sm font-semibold">
          <Music className="w-4 h-4 text-amber-ink shrink-0" />
          <span>{asset.alt}</span>
        </div>
      )}
      {/* Never autoplay: browsers block it and the host may already be playing music. */}
      <audio
        src={resolveMediaSrc(asset.src)}
        controls
        preload="metadata"
        onPlay={() => stopBackgroundMusic()}
        onError={() => setFailed(true)}
        className="w-full"
      >
        {asset.alt || 'Audio'}
      </audio>
    </div>
  );
}

/**
 * Renders a scenario's or question's optional media. Absent/empty media renders
 * nothing, so every call site is safe on legacy content.
 *
 * A failing asset degrades to its alt text — the round always stays playable.
 */
export default function MediaBlock({
  media,
  className,
}: {
  media?: MediaAsset[];
  className?: string;
}) {
  if (!media || media.length === 0) return null;

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      {media.map((asset, i) => (
        <figure key={`${asset.src}-${i}`} className="m-0">
          {asset.kind === 'audio' ? <MediaAudio asset={asset} /> : <MediaImage asset={asset} />}
          {asset.credit && (
            <figcaption className="mt-1.5 text-[10px] text-faint text-center font-medium">
              {asset.credit}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
