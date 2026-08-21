import { useEffect, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import {
  MAX_COLABORADORES,
  agregarColaborador,
  mensajeError,
  puedeEditarCurso,
  quitarColaborador,
} from '../lib/colaboradores';
import { useAuth } from '../hooks/useAuth';
import { fetchColaboradores, saveColaboradores } from '../lib/dynamicCourses';

/**
 * Quien mas entra a este curso.
 *
 * Vive en la pantalla del curso y no en el panel porque el permiso es POR
 * CURSO: un profesor puede querer que su ayudante lleve el registro de un ramo
 * y no de los otros dos. Agregar a alguien "a todo mi panel" seria una sola
 * casilla y compartiria de mas, sin aviso, cada curso que se cree despues.
 *
 * La pantalla no esconde lo que el permiso significa: quien entra puede TODO,
 * borrar el curso incluido. Esconderlo no lo haria mas seguro — las reglas son
 * las que son — y dejaria al profesor creyendo que dio permiso de mirar.
 */
export default function ColaboradoresCurso({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const [lista, setLista] = useState<string[]>([]);
  const [duenoMail, setDuenoMail] = useState<string | null>(null);
  const [duenoUid, setDuenoUid] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetchColaboradores(courseId)
      .then((r) => {
        if (!vivo) return;
        setLista(r.colaboradores);
        setDuenoMail(r.duenoMail);
        setDuenoUid(r.duenoUid);
      })
      .catch((err) => console.error('No se pudieron leer los colaboradores:', err))
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [courseId]);

  /**
   * Guarda contra Firestore y solo entonces mueve la pantalla.
   *
   * Al reves —pintar primero y guardar despues— una escritura rechazada deja
   * en pantalla a un colaborador que no existe, y el profesor se va convencido
   * de que su ayudante ya tiene acceso. Se entera la semana siguiente, cuando
   * el ayudante no puede entrar.
   */
  const guardar = async (siguiente: string[]) => {
    setGuardando(true);
    setError(null);
    try {
      await saveColaboradores(courseId, siguiente);
      setLista(siguiente);
      return true;
    } catch (err) {
      console.error('No se pudo guardar la lista de colaboradores:', err);
      setError('No se pudo guardar. Revisa la conexión e intenta de nuevo.');
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const onAgregar = async (e: React.FormEvent) => {
    e.preventDefault();
    // Los cursos creados antes de `professorEmail` no guardan el correo del
    // dueno. Cuando quien mira ES el dueno, el suyo sirve igual — que es el
    // unico caso en que agregarse a si mismo por error tiene sentido.
    const mailDelDueno = duenoMail ?? (duenoUid && user?.uid === duenoUid ? user.email : null);
    const r = agregarColaborador(lista, nuevo, mailDelDueno);
    if (!r.ok) {
      setError(mensajeError(r.error));
      return;
    }
    if (await guardar(r.lista)) setNuevo('');
  };

  const onQuitar = async (mail: string) => {
    if (!window.confirm(`Quitar a ${mail}? Deja de ver este curso en su panel.`)) return;
    await guardar(quitarColaborador(lista, mail));
  };

  if (cargando) return null;

  // La URL de un curso es adivinable y `courses/{id}` lo lee cualquier
  // autenticado, asi que otro profesor puede llegar hasta aca. Las reglas lo
  // frenan igual, pero mostrarle un formulario que Firestore siempre va a
  // rechazar es prometerle algo que no va a pasar.
  if (!puedeEditarCurso({ professorId: duenoUid ?? undefined, colaboradores: lista },
                        user ? { uid: user.uid, email: user.email } : null)) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold mb-1">Quién más entra a este curso</h2>
      <p className="text-muted text-sm mb-4">
        Los correos de esta lista ven el curso en su panel y pueden hacer{' '}
        <strong>todo lo que puedes tú</strong>: crear juegos, escribir y borrar sesiones,
        ver los reportes y borrar el curso. Agrégalos con el correo de Google con el que
        entran, aunque todavía no hayan abierto la plataforma.
      </p>

      {lista.length > 0 && (
        <ul className="space-y-2 mb-4">
          {lista.map((mail) => (
            <li key={mail} className="dramatic-card px-4 py-3 flex items-center justify-between gap-3">
              <span className="truncate">{mail}</span>
              <button
                onClick={() => onQuitar(mail)}
                disabled={guardando}
                title="Quitar"
                aria-label={`Quitar a ${mail}`}
                className="p-2 rounded-lg text-muted hover:text-kahoot-red hover:bg-surface-2 transition-colors disabled:opacity-40 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {lista.length < MAX_COLABORADORES ? (
        <form onSubmit={onAgregar} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={nuevo}
            onChange={(e) => { setNuevo(e.target.value); setError(null); }}
            placeholder="correo@gmail.com"
            aria-label="Correo de quien quieres agregar"
            className="flex-1 bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button
            type="submit"
            disabled={guardando || !nuevo.trim()}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors font-semibold disabled:opacity-40"
          >
            <UserPlus className="w-4 h-4" />
            {guardando ? 'Guardando...' : 'Agregar'}
          </button>
        </form>
      ) : (
        <p className="text-muted text-sm">
          Ya son {MAX_COLABORADORES}, que es el máximo. Quita a alguien para agregar a otra persona.
        </p>
      )}

      {error && <p className="text-rose-400 text-sm mt-2">{error}</p>}

      {/* La plataforma tiene UNA puerta de entrada y esta lista no es otra:
          agregar un correo no aprueba a nadie. Sin este aviso, el profesor
          agrega a su ayudante, el ayudante entra, ve la pantalla de solicitud y
          los dos creen que algo se rompio. */}
      <p className="text-muted text-xs mt-3">
        Quien agregues tiene que pedir acceso a la plataforma por su cuenta y esperar a que
        se lo aprueben. Hasta entonces, el curso no le va a aparecer.
      </p>
    </section>
  );
}
