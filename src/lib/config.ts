// App-wide constants (no secrets).

// Mercado Pago payment link for donations.
// Empty string = donation buttons are not rendered.
export const DONATION_URL = '';

// Platform admin: approves professor access requests.
// Must match the hardcoded email in firestore.rules.
export const ADMIN_EMAILS = ['naim.bro@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
