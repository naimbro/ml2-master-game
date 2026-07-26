import { Coffee } from 'lucide-react';
import { DONATION_URL } from '../lib/config';

interface SupportLinkProps {
  variant: 'footer' | 'card';
}

// Donation link backed by a hosted Mercado Pago payment link.
// Renders nothing until DONATION_URL is configured.
// The footer variant includes its own leading separator so the host
// footer needs no conditional markup.
export default function SupportLink({ variant }: SupportLinkProps) {
  if (!DONATION_URL) return null;

  if (variant === 'footer') {
    return (
      <>
        <span className="mx-2">·</span>
        <a
          href={DONATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-muted transition-colors"
        >
          ☕ Apoya este proyecto
        </a>
      </>
    );
  }

  return (
    <div className="dramatic-card p-6 text-center">
      <p className="text-ink-soft mb-4">
        ¿Te gustó la experiencia? Este proyecto se financia con donaciones.
      </p>
      <a
        href={DONATION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="primary-button inline-flex items-center gap-2"
      >
        <Coffee className="w-5 h-5" />
        Donar con tarjeta
      </a>
    </div>
  );
}
