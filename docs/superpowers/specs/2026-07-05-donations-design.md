# Donaciones con tarjeta de crédito — Design Spec

**Fecha:** 2026-07-05
**Estado:** Aprobado en brainstorming, pendiente de plan de implementación

## Objetivo

Permitir que usuarios apoyen el proyecto con donaciones por tarjeta de crédito/débito, recibidas en la cuenta chilena de Naim, sin manejar datos de tarjeta en la app (cero PCI) y compatible con hosting estático (GitHub Pages).

## Decisión

**Link de pago de Mercado Pago** creado manualmente desde el dashboard de MP. La app solo enlaza a él. No se integra SDK, no hay backend de pagos.

Limitación conocida: los links de MP Chile funcionan muy bien con tarjetas chilenas; el soporte a tarjetas extranjeras es limitado. Si aparecen donantes internacionales, se agrega un segundo link (Ko-fi) junto al de MP — fuera de alcance por ahora.

## Diseño

### Configuración
- Nueva constante en `src/lib/config.ts`: `DONATION_URL` (el link de pago de MP). Si está vacía, los botones de donación no se renderizan (permite mergear el código antes de tener el link).

### UI
1. **Home (`src/pages/student/Home.tsx`)**: en el footer, junto al crédito existente de Naim, un link discreto "☕ Apoya este proyecto" que abre `DONATION_URL` en pestaña nueva.
2. **End (`src/pages/student/End.tsx`)**: al final de la pantalla post-juego, una tarjeta pequeña: "¿Te gustó la experiencia? Este proyecto se financia con donaciones" + botón "Donar con tarjeta" → `DONATION_URL` en pestaña nueva.

Ambos con `rel="noopener noreferrer"`. Estilo consistente con la UI actual (discreto, no intrusivo).

### Paso manual (Naim, fuera del código)
1. Crear el link de pago en Mercado Pago (Tu negocio → Link de pago), idealmente con monto abierto o montos sugeridos.
2. Pegar el URL en `DONATION_URL`.

## Testing

- `npm run build` sin errores.
- Con `DONATION_URL` vacía: no aparece ningún botón.
- Con URL de prueba: ambos botones abren el link en pestaña nueva.

## Fuera de alcance

- Integración de checkout embebido (SDK de MP o Stripe).
- Registro de donaciones en Firestore / agradecimientos in-app.
- Link internacional (Ko-fi) — se agrega si hay demanda.
