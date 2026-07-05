# Donaciones (Mercado Pago) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botón de donaciones con tarjeta vía link de pago de Mercado Pago, en Home y en la pantalla final del juego.

**Architecture:** Cero backend de pagos: una constante `DONATION_URL` en `src/lib/config.ts` y un componente `SupportLink` reutilizado en dos páginas. Si la constante está vacía, no se renderiza nada (permite mergear antes de tener el link de MP).

**Tech Stack:** React + TypeScript + Vite, Tailwind (clases utilitarias existentes), lucide-react.

**Spec:** `docs/superpowers/specs/2026-07-05-donations-design.md`

---

### Task 1: Constante de configuración + componente SupportLink

**Files:**
- Create (o Modify si ya existe por el plan multi-profesor): `src/lib/config.ts`
- Create: `src/components/SupportLink.tsx`

- [ ] **Step 1: Crear branch**

```bash
git checkout -b feat/donations
```

- [ ] **Step 2: Agregar `DONATION_URL` a `src/lib/config.ts`**

Si el archivo no existe, créalo con este contenido. Si ya existe (plan multi-profesor lo crea con `ADMIN_EMAILS`), solo agrega el bloque de `DONATION_URL` al final:

```ts
// App-wide constants (no secrets).

// Mercado Pago payment link for donations.
// Empty string = donation buttons are not rendered.
export const DONATION_URL = '';
```

- [ ] **Step 3: Crear `src/components/SupportLink.tsx`**

```tsx
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
          className="hover:text-white/50 transition-colors"
        >
          ☕ Apoya este proyecto
        </a>
      </>
    );
  }

  return (
    <div className="dramatic-card p-6 text-center">
      <p className="text-white/70 mb-4">
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
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: build exitoso sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
git add src/lib/config.ts src/components/SupportLink.tsx
git commit -m "feat(donations): DONATION_URL config + SupportLink component"
```

---

### Task 2: Colocar SupportLink en Home y End

**Files:**
- Modify: `src/pages/student/Home.tsx` (footer, ~línea 203-206)
- Modify: `src/pages/student/End.tsx` (antes del botón "Volver al Inicio", ~línea 687)

- [ ] **Step 1: Agregar al footer de Home**

En `src/pages/student/Home.tsx`, agregar el import arriba:

```tsx
import SupportLink from '../../components/SupportLink';
```

Y modificar el footer actual (el separador `·` vive DENTRO de `SupportLink`, así desaparece junto con el link cuando `DONATION_URL` está vacía):

```tsx
      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 text-center text-white/30 text-sm font-medium">
        <a href="https://naimbro.github.io/" target="_blank" rel="noopener noreferrer" className="hover:text-white/50 transition-colors">Naim Bro</a> — Escuela de Gobierno, Universidad Adolfo Ibanez
        <SupportLink variant="footer" />
      </footer>
```

- [ ] **Step 2: Agregar tarjeta en End**

En `src/pages/student/End.tsx`, agregar el import:

```tsx
import SupportLink from '../../components/SupportLink';
```

Y dentro del bloque `{revealStage >= 4 && (...)}` que contiene el botón "Volver al Inicio", agregar la tarjeta ANTES del `<Link>`:

```tsx
        {/* Return Home Button */}
        {revealStage >= 4 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center pb-8 space-y-6"
          >
            <SupportLink variant="card" />
            <Link to="/" className="primary-button inline-flex items-center gap-2">
              <Home className="w-5 h-5" />
              Volver al Inicio
            </Link>
          </motion.div>
        )}
```

(Cambios respecto al original: `className` gana `space-y-6` y se inserta `<SupportLink variant="card" />`.)

- [ ] **Step 3: Verificar build y comportamiento con URL vacía**

Run: `npm run build && npm run dev`
Expected: build exitoso. En el navegador, con `DONATION_URL = ''`: el footer de Home se ve igual que antes (sin separador extra) y la pantalla End no muestra tarjeta de donación.

- [ ] **Step 4: Verificar con URL de prueba**

Poner temporalmente `DONATION_URL = 'https://example.com'` en `src/lib/config.ts`, recargar: el link aparece en el footer de Home y la tarjeta en End (para ver End rápido: `/preview-reveal` no sirve — es otro overlay; basta montar cualquier juego de prueba o revisar visualmente Home, que usa el mismo componente). Revertir a `''` antes de commitear si Naim aún no crea el link real.

- [ ] **Step 5: Commit**

```bash
git add src/pages/student/Home.tsx src/pages/student/End.tsx src/components/SupportLink.tsx
git commit -m "feat(donations): support link in Home footer + End screen card"
```

---

### Task 3 (manual, Naim): Crear el link de pago y activarlo

- [ ] **Step 1:** En Mercado Pago (Tu negocio → Link de pago) crear un link de donación, idealmente con monto abierto.
- [ ] **Step 2:** Pegar el URL en `DONATION_URL` en `src/lib/config.ts`, commit:

```bash
git add src/lib/config.ts
git commit -m "feat(donations): set Mercado Pago payment link"
```

- [ ] **Step 3:** Merge a `main` y push (GitHub Actions despliega el frontend automáticamente).
