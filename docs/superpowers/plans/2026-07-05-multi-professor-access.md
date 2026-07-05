# Multi-Professor Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquier profesor entre con Google, solicite acceso (Naim aprueba), cree cursos en Firestore y genere sesiones completas con un asistente IA — sin programar.

**Architecture:** Los cursos dinámicos viven en Firestore (`courses/` + subcolección `sessions/`) con el MISMO esquema JSON que los archivos actuales de `content/sessions/`, por lo que `CreateGame` y el pipeline de jueces no cambian (el contenido viaja embebido en el doc del juego). El gate de seguridad va en `firestore.rules` (la creación de juegos es client-side `setDoc`). Una cloud function nueva (`generateSessionDraft`) genera el borrador con OpenAI.

**Tech Stack:** React + TypeScript + Vite, Firestore, Firebase Cloud Functions (v1 API, `functions.https.onCall`), OpenAI `gpt-4o`, vitest.

**Spec:** `docs/superpowers/specs/2026-07-05-multi-professor-access-design.md`

**Convenciones del repo que debes respetar:**
- Sin acentos en strings de UI existentes es INCONSISTENTE (hay mezcla); usa español correcto con acentos en UI nueva.
- Clases CSS reutilizadas: `bg-gradient-main`, `dramatic-card`, `primary-button`, `gradient-text`.
- Jueces genéricos ya seedeados en `config/judges`: `technical_expert`, `public_sector`, `professor_twin` (verificado en `seedJudges`, `functions/src/index.ts:1273+`).
- Tests: vitest en root (`npm test`) y en functions (`cd functions && npm test`).
- Deploy de functions NUNCA desde `/mnt/c` — ver procedimiento `/tmp` en `CLAUDE.md`. Deploy de rules sí funciona desde el repo: `npx firebase deploy --only firestore:rules --project ml2-master-game`.

---

## FASE A — Cuentas, aprobación y cursos dinámicos

### Task 1: Branch + constantes admin + lógica de acceso (TDD)

**Files:**
- Create (o Modify si ya existe por el plan de donaciones): `src/lib/config.ts`
- Create: `src/lib/professorAccess.ts`
- Test: `src/lib/professorAccess.test.ts`

- [ ] **Step 1: Crear branch**

```bash
git checkout -b feat/multi-professor
```

- [ ] **Step 2: Crear `src/lib/config.ts`** (si ya existe, agregar solo el bloque de admin)

```ts
// App-wide constants (no secrets).

// Platform admin: approves professor access requests.
// Must match the hardcoded email in firestore.rules.
export const ADMIN_EMAILS = ['naim.bro@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
```

- [ ] **Step 3: Escribir el test que falla**

`src/lib/professorAccess.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getProfessorAccess, canUsePlatform } from './professorAccess';

describe('getProfessorAccess', () => {
  it('admin email wins regardless of status', () => {
    expect(getProfessorAccess('naim.bro@gmail.com', undefined)).toBe('admin');
    expect(getProfessorAccess('naim.bro@gmail.com', 'rejected')).toBe('admin');
  });

  it('maps professor status', () => {
    expect(getProfessorAccess('otra@gmail.com', 'approved')).toBe('approved');
    expect(getProfessorAccess('otra@gmail.com', 'pending')).toBe('pending');
    expect(getProfessorAccess('otra@gmail.com', 'rejected')).toBe('rejected');
  });

  it('no profile -> none', () => {
    expect(getProfessorAccess('otra@gmail.com', undefined)).toBe('none');
    expect(getProfessorAccess(null, undefined)).toBe('none');
  });
});

describe('canUsePlatform', () => {
  it('only admin and approved can use it', () => {
    expect(canUsePlatform('admin')).toBe(true);
    expect(canUsePlatform('approved')).toBe(true);
    expect(canUsePlatform('pending')).toBe(false);
    expect(canUsePlatform('rejected')).toBe(false);
    expect(canUsePlatform('none')).toBe(false);
  });
});
```

- [ ] **Step 4: Correr el test — debe fallar**

Run: `npx vitest run src/lib/professorAccess.test.ts`
Expected: FAIL (módulo `./professorAccess` no existe).

- [ ] **Step 5: Implementar `src/lib/professorAccess.ts`**

```ts
import { isAdminEmail } from './config';

export type ProfessorStatus = 'pending' | 'approved' | 'rejected';
export type ProfessorAccess = 'admin' | 'approved' | 'pending' | 'rejected' | 'none';

export function getProfessorAccess(
  email: string | null | undefined,
  status: ProfessorStatus | undefined,
): ProfessorAccess {
  if (isAdminEmail(email)) return 'admin';
  if (status === 'approved' || status === 'pending' || status === 'rejected') return status;
  return 'none';
}

export function canUsePlatform(access: ProfessorAccess): boolean {
  return access === 'admin' || access === 'approved';
}
```

- [ ] **Step 6: Correr el test — debe pasar**

Run: `npx vitest run src/lib/professorAccess.test.ts`
Expected: PASS (6 asserts en 4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/config.ts src/lib/professorAccess.ts src/lib/professorAccess.test.ts
git commit -m "feat(professors): admin config + access-level logic"
```

---

### Task 2: Tipos de profesor + hook useProfessor

**Files:**
- Create: `src/types/professor.ts`
- Create: `src/hooks/useProfessor.ts`

- [ ] **Step 1: Crear `src/types/professor.ts`**

```ts
import type { Timestamp } from 'firebase/firestore';
import type { ProfessorStatus } from '../lib/professorAccess';

export interface ProfessorProfile {
  uid: string;
  email: string;
  displayName: string;
  institution: string;
  motivation: string;
  status: ProfessorStatus;
  requestedAt: Timestamp;
  reviewedAt?: Timestamp;
}
```

- [ ] **Step 2: Crear `src/hooks/useProfessor.ts`**

```ts
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { getProfessorAccess, type ProfessorAccess } from '../lib/professorAccess';
import type { ProfessorProfile } from '../types/professor';

// Live view of the caller's professor profile + computed access level.
export function useProfessor() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfessorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'professors', user.uid), (snap) => {
      setProfile(snap.exists() ? ({ ...(snap.data() as Omit<ProfessorProfile, 'uid'>), uid: snap.id }) : null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const access: ProfessorAccess = getProfessorAccess(user?.email, profile?.status);
  return { profile, access, loading };
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/types/professor.ts src/hooks/useProfessor.ts
git commit -m "feat(professors): ProfessorProfile type + useProfessor hook"
```

---

### Task 3: Página RequestAccess (solicitud + estados pending/rejected)

**Files:**
- Create: `src/pages/professor/RequestAccess.tsx`

- [ ] **Step 1: Crear `src/pages/professor/RequestAccess.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Clock, XCircle, LogOut } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import type { ProfessorAccess } from '../../lib/professorAccess';

// Shown by ProfessorGate when the user is not an approved professor.
// access === 'none'     -> request form
// access === 'pending'  -> "under review" screen
// access === 'rejected' -> rejection notice
export default function RequestAccess({ access }: { access: ProfessorAccess }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [institution, setInstitution] = useState('');
  const [motivation, setMotivation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await setDoc(doc(db, 'professors', user.uid), {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        institution: institution.trim(),
        motivation: motivation.trim(),
        status: 'pending',
        requestedAt: serverTimestamp(),
      });
      // useProfessor's onSnapshot picks up the new doc and re-renders as 'pending'.
    } catch (err) {
      console.error('Error submitting professor request:', err);
      setError('No se pudo enviar la solicitud. Intenta de nuevo.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="dramatic-card p-8 max-w-md w-full"
      >
        {access === 'pending' && (
          <div className="text-center">
            <Clock className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Solicitud en revisión</h1>
            <p className="text-white/60 mb-6">
              Tu solicitud de acceso como profesor está siendo revisada.
              Te avisaremos por correo cuando sea aprobada.
            </p>
          </div>
        )}

        {access === 'rejected' && (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Solicitud no aprobada</h1>
            <p className="text-white/60 mb-6">
              Tu solicitud no fue aprobada. Si crees que es un error, escribe a
              naim.bro@gmail.com.
            </p>
          </div>
        )}

        {access === 'none' && (
          <>
            <div className="text-center mb-6">
              <GraduationCap className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Acceso para profesores</h1>
              <p className="text-white/60">
                Cuéntanos quién eres y qué curso quieres crear. El administrador
                revisará tu solicitud.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Institución</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  required
                  maxLength={120}
                  placeholder="Ej: Universidad Adolfo Ibáñez"
                  className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">
                  ¿Qué curso quieres crear?
                </label>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  required
                  maxLength={500}
                  rows={3}
                  placeholder="Ej: Curso de políticas públicas para 30 estudiantes de magíster"
                  className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
                />
              </div>
              {error && <p className="text-rose-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="primary-button w-full py-3"
              >
                {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </form>
          </>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mx-auto mt-6 px-3 py-1.5 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Salir ({user?.email})
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: sin errores (la página aún no está ruteada; se conecta en Task 4).

- [ ] **Step 3: Commit**

```bash
git add src/pages/professor/RequestAccess.tsx
git commit -m "feat(professors): RequestAccess page (form + pending/rejected states)"
```

---

### Task 4: ProfessorGate en App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Agregar imports y componente `ProfessorGate`**

En `src/App.tsx`, agregar imports:

```tsx
import type { ReactNode } from 'react';
import RequestAccess from './pages/professor/RequestAccess';
import { useProfessor } from './hooks/useProfessor';
import { canUsePlatform } from './lib/professorAccess';
```

Y ANTES de `function AppRoutes()`, agregar:

```tsx
// Wraps professor routes: approved professors and the admin pass through;
// everyone else sees the access-request flow.
function ProfessorGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { access, loading } = useProfessor();

  if (!user) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!canUsePlatform(access)) return <RequestAccess access={access} />;
  return <>{children}</>;
}
```

- [ ] **Step 2: Envolver las rutas de profesor**

Reemplazar las 4 rutas de profesor existentes por:

```tsx
      {/* Professor routes */}
      <Route
        path="/professor"
        element={user ? <ProfessorGate><Dashboard /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/create"
        element={user ? <ProfessorGate><CreateGame /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/courses/:courseId/create"
        element={user ? <ProfessorGate><CreateGame /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/report/:gameCode"
        element={user ? <ProfessorGate><ClassReport /></ProfessorGate> : <Navigate to="/" replace />}
      />
```

- [ ] **Step 3: Verificar build + smoke test manual**

Run: `npm run build && npm run dev`
Expected: build OK. Logueado como naim.bro@gmail.com, `/professor` muestra el Dashboard normal (admin pasa directo). Con otra cuenta Google, `/professor` muestra el formulario de solicitud (fallará al enviar hasta deployar rules en Task 6 — esperado).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(professors): ProfessorGate guarding professor routes"
```

---

### Task 5: AdminPanel

**Files:**
- Create: `src/pages/professor/AdminPanel.tsx`
- Modify: `src/App.tsx` (ruta nueva)

- [ ] **Step 1: Crear `src/pages/professor/AdminPanel.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, X, ShieldCheck, Users } from 'lucide-react';
import {
  collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useProfessor } from '../../hooks/useProfessor';
import type { ProfessorProfile } from '../../types/professor';

export default function AdminPanel() {
  const { access, loading } = useProfessor();
  const [pending, setPending] = useState<ProfessorProfile[]>([]);
  const [approved, setApproved] = useState<ProfessorProfile[]>([]);

  useEffect(() => {
    if (access !== 'admin') return;
    const toProfile = (d: { id: string; data: () => unknown }) =>
      ({ ...(d.data() as Omit<ProfessorProfile, 'uid'>), uid: d.id });
    const unsubPending = onSnapshot(
      query(collection(db, 'professors'), where('status', '==', 'pending')),
      (snap) => setPending(snap.docs.map(toProfile)),
    );
    const unsubApproved = onSnapshot(
      query(collection(db, 'professors'), where('status', '==', 'approved')),
      (snap) => setApproved(snap.docs.map(toProfile)),
    );
    return () => { unsubPending(); unsubApproved(); };
  }, [access]);

  const review = async (uid: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(db, 'professors', uid), { status, reviewedAt: serverTimestamp() });
  };

  if (loading) return null;
  if (access !== 'admin') return <Navigate to="/professor" replace />;

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link to="/professor" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors w-fit">
          <ArrowLeft className="w-5 h-5" />
          Volver al panel
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-cyan-400" />
            Administración de profesores
          </h1>

          <h2 className="text-xl font-bold mb-4">
            Solicitudes pendientes {pending.length > 0 && `(${pending.length})`}
          </h2>
          {pending.length === 0 && (
            <p className="text-white/50 mb-8">No hay solicitudes pendientes.</p>
          )}
          <div className="space-y-4 mb-10">
            {pending.map((p) => (
              <div key={p.uid} className="dramatic-card p-5">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-bold">{p.displayName || p.email}</p>
                    <p className="text-white/60 text-sm">{p.email} · {p.institution}</p>
                    <p className="text-white/70 text-sm mt-2">{p.motivation}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => review(p.uid, 'approved')}
                      className="flex items-center gap-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-lg transition-colors text-sm font-semibold"
                    >
                      <Check className="w-4 h-4" /> Aprobar
                    </button>
                    <button
                      onClick={() => review(p.uid, 'rejected')}
                      className="flex items-center gap-1 px-3 py-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg transition-colors text-sm font-semibold"
                    >
                      <X className="w-4 h-4" /> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-white/50" />
            Profesores aprobados ({approved.length})
          </h2>
          <div className="space-y-2">
            {approved.map((p) => (
              <div key={p.uid} className="bg-white/5 rounded-lg px-4 py-3 flex justify-between items-center">
                <div>
                  <span className="font-semibold">{p.displayName || p.email}</span>
                  <span className="text-white/50 text-sm ml-2">{p.email} · {p.institution}</span>
                </div>
                <button
                  onClick={() => review(p.uid, 'rejected')}
                  className="text-white/40 hover:text-rose-400 text-sm transition-colors"
                >
                  Revocar
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `src/App.tsx`**

Import: `import AdminPanel from './pages/professor/AdminPanel';`

Ruta (junto a las demás de profesor):

```tsx
      <Route
        path="/professor/admin"
        element={user ? <ProfessorGate><AdminPanel /></ProfessorGate> : <Navigate to="/" replace />}
      />
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/pages/professor/AdminPanel.tsx src/App.tsx
git commit -m "feat(professors): admin panel to approve/reject requests"
```

---

### Task 6: firestore.rules — profesores, cursos dinámicos y cierre del hueco de games

**Files:**
- Modify: `firestore.rules` (reemplazo completo)

- [ ] **Step 1: Reemplazar `firestore.rules` completo con:**

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // Must match ADMIN_EMAILS in src/lib/config.ts
    function isAdmin() {
      return request.auth != null && request.auth.token.email == 'naim.bro@gmail.com';
    }

    function isApprovedProfessor() {
      return request.auth != null && (
        isAdmin() ||
        (exists(/databases/$(database)/documents/professors/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/professors/$(request.auth.uid)).data.status == 'approved')
      );
    }

    function ownsCourse(courseId) {
      let course = get(/databases/$(database)/documents/courses/$(courseId)).data;
      return request.auth != null && request.auth.uid == course.professorId;
    }

    // Professor access requests + profiles
    match /professors/{uid} {
      // A user may create ONLY their own request, and only as 'pending'
      allow create: if isOwner(uid) &&
                    request.resource.data.status == 'pending' &&
                    request.resource.data.uid == uid;
      // Owner sees their own doc; admin sees (and lists) all
      allow read: if isOwner(uid) || isAdmin();
      // Only the admin changes status
      allow update, delete: if isAdmin();
    }

    // Courses collection (dynamic, professor-authored)
    match /courses/{courseId} {
      allow read: if isAuthenticated();
      allow create: if isApprovedProfessor() &&
                    request.resource.data.professorId == request.auth.uid;
      allow update, delete: if isAdmin() || ownsCourse(courseId);

      match /sessions/{sessionId} {
        allow read: if isAuthenticated();
        allow write: if isAdmin() || ownsCourse(courseId);
      }

      match /analytics/{docId} {
        allow read: if isAdmin() || ownsCourse(courseId);
        allow write: if false; // Only Cloud Functions write
      }
    }

    // Students collection - cross-course student profiles
    match /students/{studentId} {
      allow read, write: if isOwner(studentId);

      match /courseData/{courseId} {
        allow read: if isOwner(studentId) || ownsCourse(courseId);
        allow write: if false; // Only Cloud Functions write
      }
    }

    // Games collection
    match /games/{gameCode} {
      allow read: if isAuthenticated();

      // Creating games consumes OpenAI budget downstream -> approved professors only
      allow create: if isApprovedProfessor();

      // Students join/submit by updating the game doc
      allow update: if isAuthenticated();

      allow delete: if isAdmin() || (isAuthenticated() && resource.data.hostId == request.auth.uid);

      match /players/{playerId} {
        allow read: if isAuthenticated();
        allow write: if isOwner(playerId);
      }

      match /submissions/{submissionId} {
        allow read: if isAuthenticated();
        allow create: if isAuthenticated() && request.resource.data.playerId == request.auth.uid;
        allow update: if false; // Only Cloud Functions write evaluations
      }

      match /rounds/{roundId} {
        allow read: if isAuthenticated();
        allow write: if false; // Only Cloud Functions write
      }
    }

    // Judges configuration (read-only for frontend)
    match /judges/{judgeId} {
      allow read: if isAuthenticated();
      allow write: if false;
    }
  }
}
```

- [ ] **Step 2: Deployar rules** (esto SÍ funciona desde `/mnt/c`; solo functions tiene el problema de timeout)

Run: `npx firebase deploy --only firestore:rules --project ml2-master-game`
Expected: `✔ Deploy complete!`

- [ ] **Step 3: Verificación manual del cierre de seguridad**

Con una cuenta Google que NO sea admin ni profesor aprobado, en la consola del navegador de la app intentar crear un doc en `games/` (o simplemente enviar la solicitud de acceso desde la UI de Task 3 y verificar que se crea `professors/{uid}` con status pending). Verificar en Firebase console → Firestore que:
1. El doc `professors/{uid}` existe con `status: 'pending'`.
2. Un intento de `setDoc` a `games/TEST01` desde esa cuenta es rechazado con `permission-denied`.

- [ ] **Step 4: Flujo completo solicitud→aprobación**

Con la cuenta de prueba: enviar solicitud → pantalla "Solicitud en revisión". Como admin en `/professor/admin`: aprobar. La cuenta de prueba (sin recargar, gracias a onSnapshot) pasa a ver el Dashboard.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules
git commit -m "feat(security): professor approval gates in firestore rules; only approved professors create games"
```

---

### Task 7: Mappers de cursos dinámicos (TDD) + capa de I/O Firestore

**Files:**
- Create: `src/lib/courseMappers.ts`
- Create: `src/lib/dynamicCourses.ts`
- Test: `src/lib/courseMappers.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`src/lib/courseMappers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { courseDocToCourse, sessionDocToOption, colorById, COURSE_COLORS } from './courseMappers';

describe('colorById', () => {
  it('finds a color by id and falls back to the first one', () => {
    expect(colorById('emerald').id).toBe('emerald');
    expect(colorById('nope')).toBe(COURSE_COLORS[0]);
    expect(colorById(undefined)).toBe(COURSE_COLORS[0]);
  });
});

describe('courseDocToCourse', () => {
  it('maps a firestore course doc to the Course shape', () => {
    const course = courseDocToCourse('abc123', {
      name: 'Políticas Públicas',
      shortName: 'PP',
      tagline: 'Curso de prueba',
      color: 'emerald',
      professorId: 'uid1',
    });
    expect(course.id).toBe('abc123');
    expect(course.name).toBe('Políticas Públicas');
    expect(course.accentClass).toContain('emerald');
    expect(course.iconClass).toContain('emerald');
  });

  it('defaults missing fields', () => {
    const course = courseDocToCourse('x', {});
    expect(course.name).toBe('Curso sin nombre');
    expect(course.tagline).toBe('');
    expect(course.accentClass).toBe(COURSE_COLORS[0].accentClass);
  });
});

describe('sessionDocToOption', () => {
  it('maps a firestore session doc to the SessionOption shape', () => {
    const opt = sessionDocToOption('course1', 'sess1', {
      title: 'Sesión 1',
      description: 'desc',
      config: { roundDurationSeconds: 240 },
      scenarios: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
      rubric: { dimensions: [] },
      knowledgeBase: '# KB',
    });
    expect(opt.id).toBe('sess1');
    expect(opt.courseId).toBe('course1');
    expect(opt.rounds).toBe(3);
    expect(opt.duration).toBe(4);
    expect(opt.knowledgeBase).toBe('# KB');
  });

  it('defaults duration to 5 min and rounds to 0 when data is missing', () => {
    const opt = sessionDocToOption('c', 's', {});
    expect(opt.rounds).toBe(0);
    expect(opt.duration).toBe(5);
    expect(opt.title).toBe('Sesión sin título');
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npx vitest run src/lib/courseMappers.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `src/lib/courseMappers.ts`**

IMPORTANTE: usar SOLO `import type` desde `./courses` — un import normal cargaría todos los JSON/markdown bundleados y rompería el test.

```ts
// Pure mapping helpers: Firestore course/session docs -> the same shapes
// the hardcoded catalog in courses.ts produces. No firebase imports here
// (keeps this file unit-testable).
import type { Course, SessionOption } from './courses';

export interface CourseColor {
  id: string;
  accentClass: string;
  iconClass: string;
}

export const COURSE_COLORS: CourseColor[] = [
  { id: 'cyan', accentClass: 'from-cyan-500 to-purple-600', iconClass: 'bg-gradient-to-br from-cyan-500 to-purple-600' },
  { id: 'rose', accentClass: 'from-rose-500 to-amber-500', iconClass: 'bg-gradient-to-br from-rose-500 to-amber-500' },
  { id: 'emerald', accentClass: 'from-emerald-500 to-teal-600', iconClass: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
  { id: 'blue', accentClass: 'from-blue-500 to-indigo-600', iconClass: 'bg-gradient-to-br from-blue-500 to-indigo-600' },
  { id: 'amber', accentClass: 'from-amber-500 to-orange-600', iconClass: 'bg-gradient-to-br from-amber-500 to-orange-600' },
];

export function colorById(id: string | undefined): CourseColor {
  return COURSE_COLORS.find((c) => c.id === id) ?? COURSE_COLORS[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function courseDocToCourse(id: string, data: any): Course {
  const color = colorById(data.color);
  return {
    id,
    name: data.name || 'Curso sin nombre',
    shortName: data.shortName || (data.name || '?').slice(0, 4),
    tagline: data.tagline || '',
    accentClass: color.accentClass,
    iconClass: color.iconClass,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sessionDocToOption(courseId: string, id: string, data: any): SessionOption {
  const scenarios = data.scenarios || [];
  const durationSeconds = data.config?.roundDurationSeconds || 300;
  return {
    id,
    courseId,
    title: data.title || data.config?.title || 'Sesión sin título',
    description: data.description || data.config?.description || '',
    rounds: scenarios.length,
    duration: Math.round(durationSeconds / 60),
    config: data.config || {},
    scenarios,
    rubric: data.rubric || {},
    knowledgeBase: data.knowledgeBase || '',
  };
}
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `npx vitest run src/lib/courseMappers.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Implementar `src/lib/dynamicCourses.ts`** (capa I/O, sin tests unitarios — es pass-through a Firestore)

```ts
// Firestore I/O for professor-authored (dynamic) courses and sessions.
import {
  addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { courseDocToCourse, sessionDocToOption } from './courseMappers';
import type { Course, SessionOption } from './courses';

export interface SessionWithStatus extends SessionOption {
  status: 'draft' | 'ready';
}

export async function fetchMyCourses(uid: string): Promise<Course[]> {
  const snap = await getDocs(query(collection(db, 'courses'), where('professorId', '==', uid)));
  return snap.docs.map((d) => courseDocToCourse(d.id, d.data()));
}

export async function fetchCourse(courseId: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, 'courses', courseId));
  return snap.exists() ? courseDocToCourse(snap.id, snap.data()) : null;
}

export async function fetchSessions(courseId: string): Promise<SessionWithStatus[]> {
  const snap = await getDocs(collection(db, 'courses', courseId, 'sessions'));
  return snap.docs.map((d) => ({
    ...sessionDocToOption(courseId, d.id, d.data()),
    status: (d.data().status === 'ready' ? 'ready' : 'draft'),
  }));
}

export async function fetchReadySessions(courseId: string): Promise<SessionOption[]> {
  return (await fetchSessions(courseId)).filter((s) => s.status === 'ready');
}

export async function createCourse(
  uid: string,
  input: { name: string; shortName: string; tagline: string; color: string },
): Promise<string> {
  const ref = await addDoc(collection(db, 'courses'), {
    ...input,
    professorId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
```

- [ ] **Step 6: Verificar build + tests completos**

Run: `npm run build && npm test`
Expected: build OK; todos los tests pasan (incluidos los preexistentes de scripts/).

- [ ] **Step 7: Commit**

```bash
git add src/lib/courseMappers.ts src/lib/courseMappers.test.ts src/lib/dynamicCourses.ts
git commit -m "feat(courses): firestore-backed dynamic courses (mappers + IO)"
```

---

### Task 8: CourseForm (crear curso) + ruta

**Files:**
- Create: `src/pages/professor/CourseForm.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Crear `src/pages/professor/CourseForm.tsx`**

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { createCourse } from '../../lib/dynamicCourses';
import { COURSE_COLORS } from '../../lib/courseMappers';

export default function CourseForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [tagline, setTagline] = useState('');
  const [color, setColor] = useState(COURSE_COLORS[0].id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const courseId = await createCourse(user.uid, {
        name: name.trim(),
        shortName: shortName.trim() || name.trim().slice(0, 6),
        tagline: tagline.trim(),
        color,
      });
      navigate(`/professor/courses/${courseId}`);
    } catch (err) {
      console.error('Error creating course:', err);
      setError('No se pudo crear el curso. Intenta de nuevo.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link to="/professor" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors w-fit">
          <ArrowLeft className="w-5 h-5" />
          Volver al panel
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-cyan-400" />
            Crear curso
          </h1>
          <p className="text-white/60 mb-8">
            Después de crear el curso podrás generar sesiones con el asistente IA.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-white/70 mb-1">Nombre del curso</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                required maxLength={80} placeholder="Ej: Economía del Comportamiento"
                className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Nombre corto (opcional)</label>
              <input
                type="text" value={shortName} onChange={(e) => setShortName(e.target.value)}
                maxLength={12} placeholder="Ej: EconC"
                className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Descripción breve</label>
              <input
                type="text" value={tagline} onChange={(e) => setTagline(e.target.value)}
                required maxLength={120} placeholder="Una línea que describa el curso"
                className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Color</label>
              <div className="flex gap-3">
                {COURSE_COLORS.map((c) => (
                  <button
                    key={c.id} type="button" onClick={() => setColor(c.id)}
                    className={`w-10 h-10 rounded-lg ${c.iconClass} transition-transform ${
                      color === c.id ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                    aria-label={`Color ${c.id}`}
                  />
                ))}
              </div>
            </div>
            {error && <p className="text-rose-400 text-sm">{error}</p>}
            <button type="submit" disabled={saving || !name.trim()} className="primary-button w-full py-4 text-lg">
              {saving ? 'Creando...' : 'Crear curso'}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `src/App.tsx`**

Import: `import CourseForm from './pages/professor/CourseForm';`

Ruta (ANTES de `/professor/courses/:courseId/create` para que `new` no matchee como courseId; en react-router v6 las rutas estáticas ganan a las dinámicas, pero mantener el orden explícito ayuda a leer):

```tsx
      <Route
        path="/professor/courses/new"
        element={user ? <ProfessorGate><CourseForm /></ProfessorGate> : <Navigate to="/" replace />}
      />
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/pages/professor/CourseForm.tsx src/App.tsx
git commit -m "feat(courses): course creation form"
```

---

### Task 9: Dashboard — cursos dinámicos + Crear curso + link admin

**Files:**
- Modify: `src/pages/professor/Dashboard.tsx`

- [ ] **Step 1: Reemplazar `src/pages/professor/Dashboard.tsx` completo con:**

```tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Gamepad2,
  BookOpen,
  ChevronRight,
  LogOut,
  GraduationCap,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useProfessor } from '../../hooks/useProfessor';
import { COURSES, getSessionsForCourse, type Course } from '../../lib/courses';
import { fetchMyCourses } from '../../lib/dynamicCourses';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { access } = useProfessor();
  const navigate = useNavigate();
  const [myCourses, setMyCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchMyCourses(user.uid).then(setMyCourses).catch((err) => {
      console.error('Error loading courses:', err);
    });
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Hardcoded catalog courses are only shown to the admin (they belong to Naim)
  const builtinCourses = access === 'admin' ? COURSES : [];

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <Gamepad2 className="w-8 h-8 text-cyan-400" />
              <span className="text-xl font-bold gradient-text">Aula Maestra</span>
            </Link>
            <span className="text-white/30">|</span>
            <span className="text-white/70">Panel del Profesor</span>
          </div>

          <div className="flex items-center gap-4">
            {access === 'admin' && (
              <Link
                to="/professor/admin"
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <span className="text-white/70 text-sm hidden sm:block">
              {user?.displayName || user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <GraduationCap className="w-5 h-5 text-cyan-400" />
            Mis Cursos
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {builtinCourses.map((course) => {
              const sessionCount = getSessionsForCourse(course.id).length;
              return (
                <Link
                  key={course.id}
                  to={`/professor/courses/${course.id}/create`}
                  className="dramatic-card p-6 hover:scale-[1.02] transition-transform cursor-pointer group"
                >
                  <div className={`w-14 h-14 ${course.iconClass} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <BookOpen className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{course.name}</h3>
                  <p className="text-white/60 text-sm mb-4">{course.tagline}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/50">
                      {sessionCount} {sessionCount === 1 ? 'sesion' : 'sesiones'}
                    </span>
                    <span className="text-cyan-400 flex items-center gap-1 font-semibold">
                      Crear juego
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              );
            })}

            {myCourses.map((course) => (
              <Link
                key={course.id}
                to={`/professor/courses/${course.id}`}
                className="dramatic-card p-6 hover:scale-[1.02] transition-transform cursor-pointer group"
              >
                <div className={`w-14 h-14 ${course.iconClass} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-1">{course.name}</h3>
                <p className="text-white/60 text-sm mb-4">{course.tagline}</p>
                <div className="flex items-center justify-end text-sm">
                  <span className="text-cyan-400 flex items-center gap-1 font-semibold">
                    Gestionar
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}

            {/* Create course card */}
            <Link
              to="/professor/courses/new"
              className="dramatic-card p-6 hover:scale-[1.02] transition-transform cursor-pointer group border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-center min-h-[220px]"
            >
              <div className="w-14 h-14 bg-white/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-7 h-7 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold mb-1">Crear curso</h3>
              <p className="text-white/60 text-sm">
                Genera sesiones con el asistente IA
              </p>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verificar build + smoke test**

Run: `npm run build && npm run dev`
Expected: como admin se ven los 3 cursos hardcodeados + tarjeta "Crear curso" + botón Admin en el header.

- [ ] **Step 3: Commit**

```bash
git add src/pages/professor/Dashboard.tsx
git commit -m "feat(courses): dashboard shows dynamic courses + create-course card + admin link"
```

---

### Task 10: CourseHome (gestión de un curso dinámico) + ruta

**Files:**
- Create: `src/pages/professor/CourseHome.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Crear `src/pages/professor/CourseHome.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Play, Pencil, FileText } from 'lucide-react';
import type { Course } from '../../lib/courses';
import { fetchCourse, fetchSessions, type SessionWithStatus } from '../../lib/dynamicCourses';

export default function CourseHome() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<SessionWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) return;
    Promise.all([fetchCourse(courseId), fetchSessions(courseId)])
      .then(([c, s]) => { setCourse(c); setSessions(s); })
      .catch((err) => console.error('Error loading course:', err))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!course || !courseId) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white/70 mb-4">Curso no encontrado</p>
          <Link to="/professor" className="text-cyan-400 hover:underline">Volver al panel</Link>
        </div>
      </div>
    );
  }

  const readyCount = sessions.filter((s) => s.status === 'ready').length;

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link to="/professor" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors w-fit">
          <ArrowLeft className="w-5 h-5" />
          Volver al panel
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-2">
            {course.name}
          </p>
          <h1 className="text-3xl font-bold mb-2">Sesiones del curso</h1>
          <p className="text-white/60 mb-8">{course.tagline}</p>

          <div className="space-y-4 mb-8">
            {sessions.map((session) => (
              <div key={session.id} className="dramatic-card p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold truncate">{session.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      session.status === 'ready'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {session.status === 'ready' ? 'Publicada' : 'Borrador'}
                    </span>
                  </div>
                  <p className="text-white/50 text-sm truncate">
                    {session.rounds} rondas · {session.duration} min por ronda
                  </p>
                </div>
                <Link
                  to={`/professor/courses/${courseId}/sessions/${session.id}/edit`}
                  className="flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm shrink-0"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </Link>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="dramatic-card p-8 text-center text-white/50">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Aún no hay sesiones. Crea la primera con el asistente IA.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Link
              to={`/professor/courses/${courseId}/sessions/new`}
              className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3"
            >
              <Plus className="w-5 h-5" />
              Nueva sesión con asistente IA
            </Link>
            {readyCount > 0 && (
              <Link
                to={`/professor/courses/${courseId}/create`}
                className="w-full py-4 text-lg flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-semibold"
              >
                <Play className="w-5 h-5" />
                Crear juego
              </Link>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `src/App.tsx`**

Import: `import CourseHome from './pages/professor/CourseHome';`

```tsx
      <Route
        path="/professor/courses/:courseId"
        element={user ? <ProfessorGate><CourseHome /></ProfessorGate> : <Navigate to="/" replace />}
      />
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores. (Los links a `sessions/new` y `sessions/:id/edit` quedan rotos hasta la Fase B — aceptable dentro del branch; las rutas se agregan en Tasks 14-15.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/professor/CourseHome.tsx src/App.tsx
git commit -m "feat(courses): course home with session list"
```

---

### Task 11: CreateGame — soporte de cursos dinámicos

**Files:**
- Modify: `src/pages/professor/CreateGame.tsx`

- [ ] **Step 1: Agregar imports y estado dinámico**

En `src/pages/professor/CreateGame.tsx`, agregar a los imports existentes:

```tsx
import { useEffect } from 'react'; // merge con el import de useState existente: import { useState, useEffect } from 'react';
import { fetchCourse, fetchReadySessions } from '../../lib/dynamicCourses';
import type { Course } from '../../lib/courses';
```

Dentro del componente, DESPUÉS de las líneas existentes:

```tsx
  const course = courseId ? getCourse(courseId) : null;
  const sessionsForCourse = courseId ? getSessionsForCourse(courseId) : SESSIONS;
```

reemplazar esas dos líneas por:

```tsx
  const builtinCourse = courseId ? getCourse(courseId) : null;
  const [dynCourse, setDynCourse] = useState<Course | null>(null);
  const [dynSessions, setDynSessions] = useState<SessionOption[]>([]);
  const [dynLoading, setDynLoading] = useState(Boolean(courseId && !builtinCourse));

  useEffect(() => {
    if (!courseId || builtinCourse) return;
    Promise.all([fetchCourse(courseId), fetchReadySessions(courseId)])
      .then(([c, s]) => { setDynCourse(c); setDynSessions(s); })
      .catch((err) => console.error('Error loading dynamic course:', err))
      .finally(() => setDynLoading(false));
  }, [courseId, builtinCourse]);

  const course = builtinCourse ?? dynCourse;
  const sessionsForCourse = courseId
    ? (builtinCourse ? getSessionsForCourse(courseId) : dynSessions)
    : SESSIONS;
```

- [ ] **Step 2: Estado de carga y "no encontrado"**

Reemplazar el bloque existente:

```tsx
  // If a courseId was given but doesn't match any course, show error
  if (courseId && !course) {
```

por:

```tsx
  if (dynLoading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If a courseId was given but doesn't match any course, show error
  if (courseId && !course) {
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores. El `handleCreateGame` existente NO cambia — las sesiones dinámicas ya llegan con la misma forma `SessionOption`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/professor/CreateGame.tsx
git commit -m "feat(courses): CreateGame supports firestore-backed courses"
```

---

## FASE B — Asistente IA de sesiones

### Task 12: Validadores y prompt del generador (TDD, functions)

**Files:**
- Create: `functions/src/lib/sessionDraft.ts`
- Test: `functions/src/lib/sessionDraft.test.ts`

- [ ] **Step 1: Escribir el test que falla**

`functions/src/lib/sessionDraft.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  validateDraftInput,
  validateGeneratedDraft,
  buildGenerationPrompt,
  type SessionDraftInput,
} from './sessionDraft';

const validInput: SessionDraftInput = {
  courseId: 'c1',
  title: 'Sesión 1: Sesgos cognitivos',
  topicDescription: 'Sesgos cognitivos en decisiones de política pública, con foco en anclaje y disponibilidad.',
  audience: 'Estudiantes de magíster en políticas públicas',
  roundCount: 3,
  roundMinutes: 5,
  language: 'español',
};

function validDraft() {
  const dim = (id: string, weight: number) => ({
    id, name: id, weight, description: 'desc',
    level_100: 'a', level_80: 'b', level_60: 'c', level_40: 'd', level_20: 'e', level_0: 'f',
  });
  return {
    config: {
      title: validInput.title,
      description: 'desc',
      judges: [
        { judgeId: 'technical_expert', weight: 0.35 },
        { judgeId: 'public_sector', weight: 0.35 },
        { judgeId: 'professor_twin', weight: 0.3 },
      ],
      judgeConfig: {
        technical_expert: { sessionLens: 'lens', weightFormula: 'score = 0.4 * a + 0.3 * b + 0.3 * c' },
        public_sector: { sessionLens: 'lens', weightFormula: 'score = 0.4 * a + 0.3 * b + 0.3 * c' },
        professor_twin: { sessionLens: 'lens', weightFormula: 'score = 0.4 * a + 0.3 * b + 0.3 * c' },
      },
    },
    scenarios: [
      { id: 'r1', title: 'Ronda 1', prompt: 'p1', judgeFocus: 'f1' },
      { id: 'r2', title: 'Ronda 2', prompt: 'p2', judgeFocus: 'f2' },
      { id: 'r3', title: 'Ronda 3', prompt: 'p3', judgeFocus: 'f3' },
    ],
    rubric: {
      globalInstructions: 'gi',
      dimensions: [dim('a', 0.4), dim('b', 0.3), dim('c', 0.3)],
    },
    knowledgeBase: 'x'.repeat(600),
  };
}

describe('validateDraftInput', () => {
  it('accepts valid input', () => {
    expect(validateDraftInput(validInput)).toBeNull();
  });
  it('rejects short topic description', () => {
    expect(validateDraftInput({ ...validInput, topicDescription: 'corto' })).toMatch(/tema/i);
  });
  it('rejects out-of-range round count', () => {
    expect(validateDraftInput({ ...validInput, roundCount: 1 })).toMatch(/rondas/i);
    expect(validateDraftInput({ ...validInput, roundCount: 7 })).toMatch(/rondas/i);
  });
  it('rejects non-object', () => {
    expect(validateDraftInput(null)).not.toBeNull();
    expect(validateDraftInput('x')).not.toBeNull();
  });
});

describe('validateGeneratedDraft', () => {
  it('accepts a valid draft', () => {
    expect(validateGeneratedDraft(validDraft(), validInput)).toBeNull();
  });
  it('rejects scenario count mismatch', () => {
    const d = validDraft();
    d.scenarios.pop();
    expect(validateGeneratedDraft(d, validInput)).toMatch(/escenarios/i);
  });
  it('rejects dimension weights not summing to 1', () => {
    const d = validDraft();
    d.rubric.dimensions[0].weight = 0.9;
    expect(validateGeneratedDraft(d, validInput)).toMatch(/pesos/i);
  });
  it('rejects missing rubric levels', () => {
    const d = validDraft();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (d.rubric.dimensions[0] as any).level_60;
    expect(validateGeneratedDraft(d, validInput)).toMatch(/nivel/i);
  });
  it('rejects unknown judges', () => {
    const d = validDraft();
    d.config.judges[0].judgeId = 'invented_judge';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/jueces/i);
  });
  it('rejects short knowledge base', () => {
    const d = validDraft();
    d.knowledgeBase = 'corta';
    expect(validateGeneratedDraft(d, validInput)).toMatch(/knowledge/i);
  });
});

describe('buildGenerationPrompt', () => {
  it('embeds the input parameters', () => {
    const prompt = buildGenerationPrompt(validInput);
    expect(prompt).toContain(validInput.title);
    expect(prompt).toContain(validInput.topicDescription);
    expect(prompt).toContain('3');
    expect(prompt).toContain('technical_expert');
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `cd functions && npx vitest run src/lib/sessionDraft.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `functions/src/lib/sessionDraft.ts`**

```ts
// Input validation, output validation and prompt construction for the
// AI session-draft generator. Pure functions (no firebase/openai imports)
// so they are unit-testable.

export interface SessionDraftInput {
  courseId: string;
  title: string;
  topicDescription: string;
  audience: string;
  roundCount: number;
  roundMinutes: number;
  language: string;
}

export const ALLOWED_JUDGES = ['technical_expert', 'public_sector', 'professor_twin'];

export function validateDraftInput(data: unknown): string | null {
  if (!data || typeof data !== 'object') return 'Datos inválidos';
  const d = data as Partial<SessionDraftInput>;
  if (!d.courseId || typeof d.courseId !== 'string') return 'Falta courseId';
  if (!d.title || !d.title.trim()) return 'Falta el título de la sesión';
  if (!d.topicDescription || d.topicDescription.trim().length < 30) {
    return 'Describe el tema de la sesión en al menos 30 caracteres';
  }
  if (!d.audience || !d.audience.trim()) return 'Falta la audiencia';
  if (!Number.isInteger(d.roundCount) || (d.roundCount as number) < 2 || (d.roundCount as number) > 6) {
    return 'El número de rondas debe ser entre 2 y 6';
  }
  if (!Number.isInteger(d.roundMinutes) || (d.roundMinutes as number) < 2 || (d.roundMinutes as number) > 15) {
    return 'Los minutos por ronda deben ser entre 2 y 15';
  }
  if (!d.language || !d.language.trim()) return 'Falta el idioma';
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateGeneratedDraft(draft: any, input: SessionDraftInput): string | null {
  if (!draft || typeof draft !== 'object') return 'El borrador generado no es un objeto';
  const { config, scenarios, rubric, knowledgeBase } = draft;

  if (!config || typeof config !== 'object') return 'Falta config';

  if (!Array.isArray(scenarios) || scenarios.length !== input.roundCount) {
    return `Se esperaban ${input.roundCount} escenarios, llegaron ${Array.isArray(scenarios) ? scenarios.length : 0}`;
  }
  for (const s of scenarios) {
    if (!s?.id || !s?.title || !s?.prompt) return 'Cada escenario necesita id, title y prompt';
  }

  if (!rubric || !Array.isArray(rubric.dimensions) || rubric.dimensions.length < 2) {
    return 'La rúbrica necesita al menos 2 dimensiones';
  }
  const LEVELS = ['level_100', 'level_80', 'level_60', 'level_40', 'level_20', 'level_0'];
  let weightSum = 0;
  for (const dim of rubric.dimensions) {
    if (!dim?.id || !dim?.name || typeof dim?.weight !== 'number') {
      return 'Cada dimensión necesita id, name y weight numérico';
    }
    weightSum += dim.weight;
    for (const level of LEVELS) {
      if (typeof dim[level] !== 'string' || !dim[level]) return `Falta el nivel ${level} en la dimensión ${dim.id}`;
    }
  }
  if (Math.abs(weightSum - 1) > 0.01) return `Los pesos de las dimensiones suman ${weightSum.toFixed(2)}, deben sumar 1`;

  if (!Array.isArray(config.judges) || config.judges.length === 0) return 'Faltan jueces en config';
  for (const j of config.judges) {
    if (!ALLOWED_JUDGES.includes(j?.judgeId)) {
      return `Jueces inválidos: solo se permiten ${ALLOWED_JUDGES.join(', ')}`;
    }
  }

  if (typeof knowledgeBase !== 'string' || knowledgeBase.length < 500) {
    return 'La knowledge base es muy corta (mínimo 500 caracteres)';
  }
  return null;
}

export function buildGenerationPrompt(input: SessionDraftInput): string {
  const dimensionExample = `{
      "id": "identificador_snake_case",
      "name": "Nombre de la dimensión",
      "weight": 0.35,
      "description": "Qué evalúa esta dimensión",
      "level_100": "Descripción de una respuesta excelente",
      "level_80": "Descripción de una respuesta muy buena",
      "level_60": "Descripción de una respuesta aceptable",
      "level_40": "Descripción de una respuesta débil",
      "level_20": "Descripción de una respuesta muy débil",
      "level_0": "No responde o texto irrelevante"
    }`;

  return `Eres un diseñador instruccional experto en juegos educativos competitivos con evaluación por IA.

Diseña una sesión de juego para la plataforma Aula Maestra. Los estudiantes responden por escrito, bajo presión de tiempo, a escenarios desafiantes; tres jueces IA evalúan cada respuesta con una rúbrica.

DATOS DE LA SESIÓN:
- Título: ${input.title}
- Tema: ${input.topicDescription}
- Audiencia: ${input.audience}
- Número de rondas: ${input.roundCount}
- Minutos por ronda: ${input.roundMinutes}
- Idioma de todo el contenido: ${input.language}

PRINCIPIOS DE DISEÑO (síguelos estrictamente):
1. Cada escenario plantea un caso concreto con tensión real y pide una decisión o análisis específico, NO una pregunta de definición.
2. Los escenarios exigen tomar posición: elegir UNA opción y justificarla vale más que enumerar consideraciones.
3. La rúbrica premia especificidad, realismo y estructura; penaliza respuestas genéricas, listas sin posición y soluciones mágicas.
4. La knowledge base entrega el contexto mínimo que un estudiante necesita para responder bien (conceptos clave, datos del caso, definiciones) en 800-1500 palabras, formato markdown.
5. La dificultad crece levemente entre rondas.

RESPONDE SOLO CON UN JSON VÁLIDO con esta estructura EXACTA:
{
  "config": {
    "title": "${input.title}",
    "description": "Descripción de 1-2 líneas de la sesión",
    "roundCount": ${input.roundCount},
    "roundDurationSeconds": ${input.roundMinutes * 60},
    "bufferSeconds": 60,
    "conceptTags": ["3 a 6 tags en snake_case de los conceptos de la sesión"],
    "judges": [
      { "judgeId": "technical_expert", "weight": 0.35 },
      { "judgeId": "public_sector", "weight": 0.35 },
      { "judgeId": "professor_twin", "weight": 0.30 }
    ],
    "judgeConfig": {
      "technical_expert": { "sessionLens": "Instrucción de 2-4 frases que le dice a este juez qué premiar y qué penalizar EN ESTA SESIÓN, adaptada al tema", "weightFormula": "score = <pesos> usando los ids de las dimensiones de la rúbrica, ej: score = 0.40 * dim_a + 0.35 * dim_b + 0.25 * dim_c" },
      "public_sector": { "sessionLens": "...", "weightFormula": "..." },
      "professor_twin": { "sessionLens": "...", "weightFormula": "..." }
    }
  },
  "scenarios": [
    {
      "id": "r1_identificador",
      "title": "Título corto de la ronda",
      "prompt": "El escenario completo que ve el estudiante: contexto del caso (3-6 frases) + tarea específica con instrucciones de formato si aplica",
      "judgeFocus": "1-2 frases: qué deben priorizar los jueces al evaluar esta ronda",
      "ranked": true
    }
  ],
  "rubric": {
    "globalInstructions": "Instrucciones globales para los jueces: qué premiar, qué penalizar, en 3-6 frases",
    "scoring": {
      "scaleLevels": [100, 80, 60, 40, 20, 0],
      "instructions": "Evalúa SOLO lo que está escrito."
    },
    "dimensions": [
      ${dimensionExample}
    ]
  },
  "knowledgeBase": "# Título\\n\\nContenido markdown de 800-1500 palabras..."
}

REGLAS DURAS:
- Exactamente ${input.roundCount} escenarios.
- Exactamente 3 dimensiones en la rúbrica, con pesos que suman 1.0.
- Los weightFormula usan los MISMOS ids de las dimensiones.
- judges usa SOLO los judgeIds technical_expert, public_sector y professor_twin.
- Todo el texto en ${input.language}.`;
}
```

- [ ] **Step 4: Correr el test — debe pasar**

Run: `cd functions && npx vitest run src/lib/sessionDraft.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Verificar que functions compila**

Run: `cd functions && npm run build`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add functions/src/lib/sessionDraft.ts functions/src/lib/sessionDraft.test.ts
git commit -m "feat(ai-builder): session draft validators + generation prompt (TDD)"
```

---

### Task 13: Cloud function generateSessionDraft

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Agregar import arriba de `functions/src/index.ts`** (junto a los imports de `./lib/...` existentes)

```ts
import {
  validateDraftInput,
  validateGeneratedDraft,
  buildGenerationPrompt,
  type SessionDraftInput,
} from './lib/sessionDraft';
```

- [ ] **Step 2: Agregar la function al final de `functions/src/index.ts`** (antes de `seedJudges` o después — da igual, al final del archivo es más simple)

```ts
// =====================================
// GENERATE SESSION DRAFT (AI course builder)
// =====================================
const PLATFORM_ADMIN_EMAIL = 'naim.bro@gmail.com';

export const generateSessionDraft = functions
  .region('us-central1')
  .runWith({ timeoutSeconds: 300, memory: '512MB', secrets: ['OPENAI_API_KEY'] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const inputError = validateDraftInput(data);
    if (inputError) {
      throw new functions.https.HttpsError('invalid-argument', inputError);
    }
    const input = data as SessionDraftInput;

    // Only approved professors (or the admin) may burn OpenAI budget
    const callerEmail = context.auth.token.email || '';
    const isAdmin = callerEmail === PLATFORM_ADMIN_EMAIL;
    if (!isAdmin) {
      const profDoc = await db.collection('professors').doc(context.auth.uid).get();
      if (!profDoc.exists || profDoc.data()!.status !== 'approved') {
        throw new functions.https.HttpsError('permission-denied', 'Professor not approved');
      }
    }

    // Caller must own the course
    const courseDoc = await db.collection('courses').doc(input.courseId).get();
    if (!courseDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Course not found');
    }
    if (!isAdmin && courseDoc.data()!.professorId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not the course owner');
    }

    const openai = await getOpenAI();
    const prompt = buildGenerationPrompt(input);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let draft: any = null;
    let lastError = '';
    for (let attempt = 0; attempt < 2 && !draft; attempt++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'user' as const, content: prompt },
          ...(lastError
            ? [{ role: 'user' as const, content: `Tu intento anterior falló la validación: ${lastError}. Corrige y responde de nuevo SOLO con el JSON.` }]
            : []),
        ],
      });
      try {
        const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
        const validationError = validateGeneratedDraft(parsed, input);
        if (validationError) {
          lastError = validationError;
          console.warn(`generateSessionDraft attempt ${attempt + 1} invalid: ${validationError}`);
        } else {
          draft = parsed;
        }
      } catch (err) {
        lastError = 'JSON inválido';
        console.warn(`generateSessionDraft attempt ${attempt + 1} parse error:`, err);
      }
    }

    if (!draft) {
      throw new functions.https.HttpsError('internal', `La generación falló: ${lastError}. Intenta de nuevo.`);
    }

    // Server-authoritative fields (never trust the model for these)
    draft.config.roundCount = input.roundCount;
    draft.config.roundDurationSeconds = input.roundMinutes * 60;
    draft.config.title = input.title;

    const sessionRef = await db
      .collection('courses').doc(input.courseId)
      .collection('sessions').add({
        title: input.title,
        description: draft.config.description || '',
        status: 'draft',
        generatedBy: 'ai',
        config: draft.config,
        scenarios: draft.scenarios,
        rubric: draft.rubric,
        knowledgeBase: draft.knowledgeBase,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return { success: true, sessionId: sessionRef.id };
  });
```

- [ ] **Step 3: Compilar y correr todos los tests de functions**

Run: `cd functions && npm run build && npm test`
Expected: compila y todos los tests pasan.

- [ ] **Step 4: Commit** (incluir `functions/lib/` — el output compilado va commiteado en este repo)

```bash
git add functions/src/index.ts functions/lib/
git commit -m "feat(ai-builder): generateSessionDraft cloud function"
```

---

### Task 14: SessionBuilder (formulario de generación) + ruta

**Files:**
- Create: `src/pages/professor/SessionBuilder.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Crear `src/pages/professor/SessionBuilder.tsx`**

```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

export default function SessionBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [audience, setAudience] = useState('');
  const [roundCount, setRoundCount] = useState(3);
  const [roundMinutes, setRoundMinutes] = useState(5);
  const [language, setLanguage] = useState('español');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setGenerating(true);
    setError(null);
    try {
      const generate = httpsCallable(functions, 'generateSessionDraft');
      const result = await generate({
        courseId,
        title: title.trim(),
        topicDescription: topicDescription.trim(),
        audience: audience.trim(),
        roundCount,
        roundMinutes,
        language,
      });
      const { sessionId } = result.data as { sessionId: string };
      navigate(`/professor/courses/${courseId}/sessions/${sessionId}/edit`);
    } catch (err) {
      console.error('Error generating session:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(`No se pudo generar la sesión: ${message}`);
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link
          to={`/professor/courses/${courseId}`}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al curso
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-cyan-400" />
            Nueva sesión con IA
          </h1>
          <p className="text-white/60 mb-8">
            Describe qué quieres enseñar y el asistente generará un borrador completo:
            escenarios por ronda, rúbrica de evaluación y material de apoyo. Después
            podrás editar todo antes de publicar.
          </p>

          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label className="block text-sm text-white/70 mb-1">Título de la sesión</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                required maxLength={120} placeholder="Ej: Sesión 1: Sesgos cognitivos en decisiones públicas"
                className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                Tema y objetivos (mientras más detalle, mejor el borrador)
              </label>
              <textarea
                value={topicDescription} onChange={(e) => setTopicDescription(e.target.value)}
                required minLength={30} maxLength={2000} rows={5}
                placeholder="Ej: Quiero que practiquen identificar sesgos de anclaje y disponibilidad en casos reales de política pública chilena. Que tomen posición y justifiquen, no que reciten definiciones..."
                className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Audiencia</label>
              <input
                type="text" value={audience} onChange={(e) => setAudience(e.target.value)}
                required maxLength={200} placeholder="Ej: 30 estudiantes de magíster en políticas públicas"
                className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/70 mb-1">Rondas</label>
                <select
                  value={roundCount} onChange={(e) => setRoundCount(Number(e.target.value))}
                  className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n} className="bg-slate-800">{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Min/ronda</label>
                <select
                  value={roundMinutes} onChange={(e) => setRoundMinutes(Number(e.target.value))}
                  className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  {[3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n} className="bg-slate-800">{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/70 mb-1">Idioma</label>
                <select
                  value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="español" className="bg-slate-800">Español</option>
                  <option value="inglés" className="bg-slate-800">Inglés</option>
                </select>
              </div>
            </div>
            {error && <p className="text-rose-400 text-sm">{error}</p>}
            <button type="submit" disabled={generating} className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3">
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generando (puede tardar ~1 minuto)...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generar borrador
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `src/App.tsx`**

Import: `import SessionBuilder from './pages/professor/SessionBuilder';`

```tsx
      <Route
        path="/professor/courses/:courseId/sessions/new"
        element={user ? <ProfessorGate><SessionBuilder /></ProfessorGate> : <Navigate to="/" replace />}
      />
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/pages/professor/SessionBuilder.tsx src/App.tsx
git commit -m "feat(ai-builder): session generation form"
```

---

### Task 15: SessionEditor (editar borrador + publicar) + ruta

**Files:**
- Create: `src/pages/professor/SessionEditor.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Crear `src/pages/professor/SessionEditor.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJson = any;

interface DraftState {
  title: string;
  description: string;
  status: 'draft' | 'ready';
  config: AnyJson;
  scenarios: AnyJson[];
  rubric: AnyJson;
  knowledgeBase: string;
}

const RUBRIC_LEVELS = ['level_100', 'level_80', 'level_60', 'level_40', 'level_20', 'level_0'] as const;

export default function SessionEditor() {
  const { courseId, sessionId } = useParams<{ courseId: string; sessionId: string }>();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDim, setOpenDim] = useState<number | null>(null);

  useEffect(() => {
    if (!courseId || !sessionId) return;
    getDoc(doc(db, 'courses', courseId, 'sessions', sessionId))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setDraft({
            title: d.title || '',
            description: d.description || '',
            status: d.status === 'ready' ? 'ready' : 'draft',
            config: d.config || {},
            scenarios: d.scenarios || [],
            rubric: d.rubric || { dimensions: [] },
            knowledgeBase: d.knowledgeBase || '',
          });
        }
      })
      .catch((err) => console.error('Error loading session:', err))
      .finally(() => setLoading(false));
  }, [courseId, sessionId]);

  const persist = async (status: 'draft' | 'ready') => {
    if (!courseId || !sessionId || !draft) return;
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'courses', courseId, 'sessions', sessionId), {
        title: draft.title,
        description: draft.description,
        status,
        config: { ...draft.config, title: draft.title, description: draft.description },
        scenarios: draft.scenarios,
        rubric: draft.rubric,
        knowledgeBase: draft.knowledgeBase,
        updatedAt: serverTimestamp(),
      });
      setDraft({ ...draft, status });
      setSavedAt(Date.now());
    } catch (err) {
      console.error('Error saving session:', err);
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const updateScenario = (index: number, field: string, value: string) => {
    if (!draft) return;
    const scenarios = draft.scenarios.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    setDraft({ ...draft, scenarios });
  };

  const updateDimension = (index: number, field: string, value: string | number) => {
    if (!draft) return;
    const dimensions = draft.rubric.dimensions.map((d: AnyJson, i: number) =>
      i === index ? { ...d, [field]: value } : d,
    );
    setDraft({ ...draft, rubric: { ...draft.rubric, dimensions } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white/70 mb-4">Sesión no encontrada</p>
          <Link to={`/professor/courses/${courseId}`} className="text-cyan-400 hover:underline">
            Volver al curso
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = 'w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400';

  return (
    <div className="min-h-screen bg-gradient-main pb-32">
      <header className="p-4 sticky top-0 bg-black/40 backdrop-blur-md z-10 border-b border-white/10">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <Link
            to={`/professor/courses/${courseId}`}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al curso
          </Link>
          <div className="flex items-center gap-3">
            {savedAt && !saving && <span className="text-white/40 text-sm">Guardado ✓</span>}
            <button
              onClick={() => persist(draft.status)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
            <button
              onClick={() => persist('ready')}
              disabled={saving}
              className="primary-button flex items-center gap-2 px-4 py-2 text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              {draft.status === 'ready' ? 'Publicada' : 'Publicar'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {error && <p className="text-rose-400">{error}</p>}

        {/* Session metadata */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xl font-bold mb-4">Datos de la sesión</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Título</label>
              <input
                type="text" value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Descripción</label>
              <textarea
                value={draft.description} rows={2}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </motion.section>

        {/* Scenarios */}
        <section>
          <h2 className="text-xl font-bold mb-4">Rondas ({draft.scenarios.length})</h2>
          <div className="space-y-6">
            {draft.scenarios.map((scenario: AnyJson, i: number) => (
              <div key={scenario.id || i} className="dramatic-card p-5 space-y-3">
                <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider">
                  Ronda {i + 1}
                </p>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Título</label>
                  <input
                    type="text" value={scenario.title || ''}
                    onChange={(e) => updateScenario(i, 'title', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Escenario (lo que ve el estudiante)
                  </label>
                  <textarea
                    value={scenario.prompt || ''} rows={6}
                    onChange={(e) => updateScenario(i, 'prompt', e.target.value)}
                    className={`${inputClass} resize-y`}
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Foco de los jueces en esta ronda
                  </label>
                  <textarea
                    value={scenario.judgeFocus || ''} rows={2}
                    onChange={(e) => updateScenario(i, 'judgeFocus', e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rubric */}
        <section>
          <h2 className="text-xl font-bold mb-1">Rúbrica</h2>
          <p className="text-white/50 text-sm mb-4">
            Los pesos deben sumar 1.0. Cada dimensión describe qué separa una respuesta
            excelente (100) de una deficiente (0).
          </p>
          <div className="mb-4">
            <label className="block text-sm text-white/70 mb-1">Instrucciones globales para los jueces</label>
            <textarea
              value={draft.rubric.globalInstructions || ''} rows={3}
              onChange={(e) => setDraft({ ...draft, rubric: { ...draft.rubric, globalInstructions: e.target.value } })}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div className="space-y-4">
            {(draft.rubric.dimensions || []).map((dim: AnyJson, i: number) => (
              <div key={dim.id || i} className="dramatic-card p-5">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <input
                    type="text" value={dim.name || ''}
                    onChange={(e) => updateDimension(i, 'name', e.target.value)}
                    className={`${inputClass} font-bold`}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-sm text-white/50">Peso</label>
                    <input
                      type="number" step="0.05" min="0" max="1" value={dim.weight ?? 0}
                      onChange={(e) => updateDimension(i, 'weight', Number(e.target.value))}
                      className="w-20 bg-white/10 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400 text-center"
                    />
                  </div>
                </div>
                <textarea
                  value={dim.description || ''} rows={2}
                  onChange={(e) => updateDimension(i, 'description', e.target.value)}
                  className={`${inputClass} resize-none mb-3`}
                />
                <button
                  onClick={() => setOpenDim(openDim === i ? null : i)}
                  className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  {openDim === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Niveles de puntaje
                </button>
                {openDim === i && (
                  <div className="mt-3 space-y-2">
                    {RUBRIC_LEVELS.map((level) => (
                      <div key={level}>
                        <label className="block text-xs text-white/50 mb-1">
                          {level.replace('level_', 'Puntaje ')}
                        </label>
                        <textarea
                          value={dim[level] || ''} rows={2}
                          onChange={(e) => updateDimension(i, level, e.target.value)}
                          className={`${inputClass} resize-none text-sm`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Knowledge base */}
        <section>
          <h2 className="text-xl font-bold mb-1">Material de apoyo (knowledge base)</h2>
          <p className="text-white/50 text-sm mb-4">
            Contexto que los jueces usan para evaluar. Formato markdown.
          </p>
          <textarea
            value={draft.knowledgeBase} rows={16}
            onChange={(e) => setDraft({ ...draft, knowledgeBase: e.target.value })}
            className={`${inputClass} resize-y font-mono text-sm`}
          />
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Agregar la ruta en `src/App.tsx`**

Import: `import SessionEditor from './pages/professor/SessionEditor';`

```tsx
      <Route
        path="/professor/courses/:courseId/sessions/:sessionId/edit"
        element={user ? <ProfessorGate><SessionEditor /></ProfessorGate> : <Navigate to="/" replace />}
      />
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/pages/professor/SessionEditor.tsx src/App.tsx
git commit -m "feat(ai-builder): session editor with publish"
```

---

### Task 16: Deploy de functions + E2E completo

**Files:** ninguno nuevo (deploy + verificación)

- [ ] **Step 1: Deploy de functions — SIEMPRE desde `/tmp` (ver CLAUDE.md)**

OJO: el procedimiento de CLAUDE.md copia archivos individuales; este branch agrega `functions/src/lib/sessionDraft.ts` y su compilado. Copiar los directorios completos:

```bash
cd /mnt/c/Users/naim.bro.k/claude_projects/games/ml2-master-game
cd functions && npm run build && cd ..

rm -rf /tmp/functions-deploy
mkdir -p /tmp/functions-deploy/functions
cp firebase.json /tmp/functions-deploy/
echo '{"projects":{"default":"ml2-master-game"}}' > /tmp/functions-deploy/.firebaserc
cp functions/package.json functions/package-lock.json functions/tsconfig.json /tmp/functions-deploy/functions/
cp -r functions/src /tmp/functions-deploy/functions/src
cp -r functions/lib /tmp/functions-deploy/functions/lib

cd /tmp/functions-deploy/functions && npm ci
cd /tmp/functions-deploy && npx firebase deploy --only functions:generateSessionDraft
```

Expected: `✔ Deploy complete!` con la function `generateSessionDraft(us-central1)` creada.

- [ ] **Step 2: E2E con cuenta admin (rápido)**

Como naim.bro@gmail.com en la app (`npm run dev`): crear un curso de prueba → nueva sesión con IA (tema real, 2 rondas de 3 min para que sea barato) → esperar generación → revisar el borrador en el editor → publicar → crear juego → verificar que el juego se crea con código.

- [ ] **Step 3: E2E con cuenta de profesor de prueba (flujo completo)**

Con una segunda cuenta Google:
1. `/professor` → formulario de solicitud → enviar → "Solicitud en revisión".
2. Como admin: `/professor/admin` → aprobar.
3. La cuenta de prueba pasa al Dashboard (sin recargar, vía onSnapshot).
4. Crear curso → generar sesión (2 rondas) → editar un escenario → publicar.
5. Crear juego → unirse como estudiante con una tercera cuenta (o la admin en incógnito) → jugar una ronda → verificar que los jueces evalúan (el score aparece).
6. Verificar en Firebase console que `games/{code}` tiene `sessionConfig.rubric` y `scenarios` de la sesión generada.

- [ ] **Step 4: Verificación de seguridad final**

Con una CUARTA cuenta (o revocando la de prueba desde el admin panel): confirmar que `/professor` muestra el formulario de solicitud y que no puede crear juegos.

- [ ] **Step 5: Merge y deploy frontend**

```bash
git checkout main
git merge feat/multi-professor
git push origin main   # GitHub Actions despliega el frontend
```

(O crear PR si se prefiere revisión: `gh pr create`.)

---

## Cobertura spec → tasks

| Requisito de la spec | Task |
|---|---|
| Solicitud + aprobación admin | 1-6 |
| Cierre hueco de seguridad `games` create | 6 |
| Cursos dinámicos Firestore | 7-11 |
| Cursos hardcodeados intactos, solo admin | 9 |
| Asistente IA genera borrador | 12-14 |
| Editor + publicar | 15 |
| Jueces genéricos reutilizados con sessionLens | 12 (prompt) + 13 |
| Deploy functions desde /tmp | 16 |
