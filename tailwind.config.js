/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['"Archivo Black"', 'Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ── "Cancha": light ground, orange is the action colour, green is
        // reserved exclusively for "correct". Ink carries all structure.
        paper: '#FAFAF8',
        ink: '#101114',
        'ink-soft': '#3A3D45',
        muted: '#5F6269',
        faint: '#767980',
        surface: '#FFFFFF',
        'surface-2': '#F2F1ED',
        'surface-3': '#E8E7E2',
        line: '#E6E5E0',
        'line-strong': '#101114',
        // Text/icons sitting ON a saturated fill (orange button, coloured tile).
        // Named so a future palette change cannot accidentally darken them.
        onaccent: '#FFFFFF',
        // Dark variants for when an accent has to be TEXT on paper, where the
        // vivid fill versions fall below 4.5:1.
        'orange-ink': '#C2400F',
        'amber-ink': '#92400E',

        // The Kahoot names stay as an alias layer: dozens of components still
        // say `bg-kahoot-green`, and remapping here is what makes this whole
        // restyle one revertible commit instead of a thousand edits.
        kahoot: {
          purple: '#101114',        // was a background; now ink
          'purple-dark': '#F2F1ED',
          'purple-deep': '#FAFAF8',
          // Every value below is contrast-checked: usable as text on paper
          // AND as a fill under white text, except the two marked fill-only.
          green: '#0B7A46',         // "correct" only
          'green-dark': '#09693D',
          blue: '#2563EB',
          'blue-light': '#1D4ED8',
          red: '#B3272B',
          orange: '#FF5A1F',        // FILL ONLY — carries ink text, not white
          yellow: '#F5A524',        // FILL ONLY — carries ink text, not white
          // La cuarta ficha de una pregunta de alternativas. Era `green`, y a
          // tamano de ficha nadie lo noto; al dibujar el reparto de votos en
          // columnas quedo en evidencia que una alternativa verde afirma
          // "correcta" antes de que se revele nada. El verde queda reservado.
          //
          // No se puede reemplazar por cualquier cosa: rojo/azul/ambar/verde es
          // la unica de las combinaciones probadas que separa bien bajo
          // daltonismo, y este violeta choca con el azul (deltaE 12,4 normal,
          // 0,4 en deuteranopia). Vale IGUAL porque en una ficha la identidad la
          // carga la LETRA, no el color: el color es adorno. Por eso mismo el
          // grafico de columnas no pinta las columnas de estos colores.
          violet: '#7C3AED',        // 5,70:1 con blanco encima; 5,45:1 como texto sobre papel
        },
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'float-slow': 'float 8s ease-in-out 1s infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'count-up': 'countUp 0.6s ease-out',
        'confetti': 'confetti 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(5deg)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.5)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'scale(0.3) translateY(20px)' },
          '60%': { transform: 'scale(1.1) translateY(-5px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(-100vh) rotate(720deg)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
