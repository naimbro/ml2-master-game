import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { TelemetriaDoc } from '../../lib/telemetriaDerived';
import NubeEscritura from './NubeEscritura';
import RejillaHuellas from './RejillaHuellas';
import type { FilaAlumno } from './RejillaHuellas';
import DetalleRespuesta from './DetalleRespuesta';

interface EscenarioMinimo {
  id?: string;
  type?: string;
  durationSeconds?: number;
}

/**
 * «Como se escribio»: la seccion de telemetria del reporte de clase.
 *
 * Lee dos cosas directo de Firestore y no toca `generateClassReport`: la
 * subcoleccion `telemetria` (que solo el anfitrion puede leer) y el documento
 * del juego, del que saca la duracion de cada ronda.
 *
 * Si no hay telemetria — un juego anterior a esta feature, o una sesion entera
 * de seleccion multiple — no renderiza nada. Nada de estados vacios explicando
 * la ausencia: el profesor no tiene por que enterarse de una feature que ese
 * juego no uso.
 */
export default function SeccionTelemetria({
  gameCode,
  jugadores,
}: {
  gameCode: string;
  /** playerId -> nombre, del reporte que ya cargo la pagina */
  jugadores: Record<string, string>;
}) {
  const [docs, setDocs] = useState<TelemetriaDoc[]>([]);
  const [duracionPorRonda, setDuracionPorRonda] = useState<Record<number, number>>({});
  const [seleccion, setSeleccion] = useState<{ t: TelemetriaDoc; nombre: string } | null>(null);

  useEffect(() => {
    let vivo = true;

    const cargar = async () => {
      try {
        const [snap, juego] = await Promise.all([
          getDocs(collection(db, 'games', gameCode, 'telemetria')),
          getDoc(doc(db, 'games', gameCode)),
        ]);
        if (!vivo) return;

        setDocs(snap.docs.map((d) => d.data() as TelemetriaDoc));

        const datos = juego.data();
        const porDefecto = (datos?.roundDurationSeconds ?? 300) * 1000;
        const escenarios: EscenarioMinimo[] = datos?.scenarios ?? [];
        const duraciones: Record<number, number> = {};
        escenarios.forEach((e, i) => {
          duraciones[i + 1] = (e.durationSeconds ?? 0) * 1000 || porDefecto;
        });
        setDuracionPorRonda(duraciones);
      } catch (err) {
        // Un juego sin telemetria, o reglas que niegan: la seccion no se muestra
        // y el resto del reporte sigue funcionando.
        console.warn('telemetria no disponible', err);
      }
    };

    cargar();
    return () => { vivo = false; };
  }, [gameCode]);

  const rondas = useMemo(
    () => [...new Set(docs.map((d) => d.round))].sort((a, b) => a - b),
    [docs]
  );

  const filas: FilaAlumno[] = useMemo(() => {
    const porAlumno = new Map<string, FilaAlumno>();
    docs.forEach((d) => {
      const nombre = jugadores[d.playerId];
      if (!nombre) return; // no jugo o no fue evaluado: no tiene fila en el reporte
      const fila = porAlumno.get(d.playerId) ?? { playerId: d.playerId, nombre, porRonda: {} };
      fila.porRonda[d.round] = d;
      porAlumno.set(d.playerId, fila);
    });
    return [...porAlumno.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [docs, jugadores]);

  const puntos = useMemo(
    () =>
      docs
        .filter((d) => jugadores[d.playerId])
        .map((d) => ({ telemetria: d, nombre: jugadores[d.playerId] })),
    [docs, jugadores]
  );

  const duracionMax = useMemo(
    () => Math.max(60_000, ...rondas.map((r) => duracionPorRonda[r] ?? 0)),
    [rondas, duracionPorRonda]
  );

  if (docs.length === 0 || filas.length === 0) return null;

  return (
    <div className="dramatic-card p-6 mt-6">
      <h2 className="text-lg font-bold mb-1">Cómo se escribió</h2>
      <p className="text-xs text-muted mb-5">
        Registro descriptivo de las {rondas.length} rondas abiertas. No entra en ningún puntaje
        ni en el ranking.
      </p>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <p className="text-[11px] font-semibold text-muted mb-2">
            El curso · 1 punto = 1 respuesta · {puntos.length} respuestas
          </p>
          <NubeEscritura
            puntos={puntos}
            duracionMaxMs={duracionMax}
            onSeleccion={(t, nombre) => setSeleccion({ t, nombre })}
          />
          <p className="text-[11px] text-muted mt-1">
            Sin nombres. Haz clic en un punto para saber de quién es.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-muted mb-2">
            Por alumno · rampa = fue escribiendo · acantilado = llegó de una vez
          </p>
          <RejillaHuellas
            filas={filas}
            rondas={rondas}
            duracionPorRonda={duracionPorRonda}
            seleccionada={seleccion?.t ?? null}
            onSeleccion={(t, nombre) => setSeleccion({ t, nombre })}
          />
        </div>
      </div>

      {seleccion && (
        <DetalleRespuesta
          telemetria={seleccion.t}
          nombre={seleccion.nombre}
          duracionMs={duracionPorRonda[seleccion.t.round] ?? duracionMax}
        />
      )}
    </div>
  );
}
