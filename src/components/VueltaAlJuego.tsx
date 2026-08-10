import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { currentJoinUrl } from '../lib/joinUrl';

interface Props {
  gameCode: string;
  /**
   * true en la pantalla que se PROYECTA (la del anfitrion). Cambia el
   * componente entero, no solo su tamano — ver el comentario de abajo.
   */
  proyectada: boolean;
}

/**
 * Como vuelve al juego el alumno al que se le salio.
 *
 * Vive fijo en todas las pantallas de una partida, porque el momento en que
 * hace falta es justo el momento en que nadie va a ir a buscarlo a un menu.
 *
 * **Muestra dos cosas distintas segun donde esta, y esa es la decision.** Un QR
 * en el telefono del alumno no sirve para nada: no puede escanear su propia
 * pantalla. Lo que el alumno necesita es el CODIGO —para volver a tipearlo
 * despues de recargar— y un camino de vuelta. El QR sirve en la pantalla
 * proyectada, que es la que mira el que se quedo afuera, y ahi tiene que ser
 * lo bastante grande para escanearse desde la ultima fila. Es el mismo
 * criterio que ya usaba el QR del lobby.
 */
export default function VueltaAlJuego({ gameCode, proyectada }: Props) {
  const [abierto, setAbierto] = useState(false);
  if (!gameCode) return null;

  if (proyectada) {
    return (
      <div className="fixed right-3 bottom-3 z-30 bg-surface border-2 border-ink rounded-2xl p-2.5 shadow-[0_3px_0_#101114] text-center">
        <div className="bg-white rounded-lg overflow-hidden">
          <QRCodeSVG
            value={currentJoinUrl(gameCode)}
            size={92}
            level="M"
            marginSize={0}
            bgColor="#ffffff"
            fgColor="#101114"
          />
        </div>
        <p className="font-display text-sm tracking-wider mt-1.5 mb-0">{gameCode}</p>
        <p className="text-[9px] font-bold uppercase tracking-widest text-faint">Para volver a entrar</p>
      </div>
    );
  }

  // En el telefono va abajo a la IZQUIERDA: los botones de accion de estas
  // pantallas son anchos y su texto queda centrado, asi que la esquina
  // izquierda es la que menos estorba. Cerrado ocupa lo que mide el codigo.
  return (
    <div className="fixed left-3 bottom-3 z-30">
      {abierto ? (
        <div className="bg-surface border-2 border-ink rounded-xl shadow-[0_3px_0_#101114] p-3 max-w-[220px]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-faint mb-1">
            Si se te sale el juego
          </p>
          <p className="font-display text-lg tracking-wider mb-2">{gameCode}</p>
          <a
            href={currentJoinUrl(gameCode)}
            className="inline-block bg-kahoot-orange text-onaccent font-black text-sm rounded-lg px-3 py-1.5 border-2 border-ink"
          >
            Volver a entrar
          </a>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="block text-[11px] font-bold text-muted underline mt-2"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label={`Codigo del juego ${gameCode}. Como volver a entrar.`}
          className="bg-ink/85 text-white font-display text-xs tracking-wider rounded-full px-3 py-1.5 backdrop-blur-sm"
        >
          {gameCode}
        </button>
      )}
    </div>
  );
}
