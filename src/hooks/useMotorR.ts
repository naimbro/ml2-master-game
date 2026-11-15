import { useEffect, useSyncExternalStore } from 'react';
import { claveDe, motorR, type ConfigR, type EstadoMotor } from '../lib/rEnVivo';

const leerEstado = () => motorR.estado;

/**
 * Enciende R para esta sesión y devuelve en qué va. Con `null` no hace nada:
 * es lo que reciben los juegos sin bloque `rEnVivo`.
 *
 * Lo llaman el lobby (para que R esté listo antes de la ronda 1) y la ronda, y
 * los dos comparten el mismo motor: el segundo llamado no vuelve a bajar nada.
 *
 * Igual que `useTypingTelemetry`, este hook no decide nada. La lógica vive en
 * `MotorR`, que tiene tests.
 */
export function useMotorR(config: ConfigR | null): EstadoMotor {
  const estado = useSyncExternalStore(motorR.suscribir, leerEstado);

  // Depende de la CLAVE y no del objeto: `config` sale de un snapshot de
  // Firestore y es un objeto nuevo en cada actualización del juego. Con el
  // objeto en las dependencias el efecto correría cada vez que alguien entra a
  // la sala.
  const clave = config ? claveDe(config) : null;
  useEffect(() => {
    if (config) void motorR.preparar(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  // Si la carga se cayó con el teléfono apagado o en otra app, se reintenta
  // sola al volver a la pantalla. Ver `MotorR.reintentarSiFallo`.
  useEffect(() => {
    if (!clave) return;
    const alVolver = () => {
      if (document.visibilityState === 'visible') motorR.reintentarSiFallo();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [clave]);

  return estado;
}
