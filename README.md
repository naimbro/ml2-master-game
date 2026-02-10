# ML2 Master Game

Juego educativo multiplayer para el curso Machine Learning II: IA Generativa y Procesos Publicos.

## Caracteristicas

- **Escenarios del sector publico chileno**: Casos reales para aplicar conceptos de IA
- **Competencia en tiempo real**: Multiples jugadores compiten simultaneamente
- **3 jueces AI**: Evaluacion automatica con retroalimentacion detallada
- **Sistema multi-curso**: Reutilizable para diferentes cursos y demos
- **Analiticas de aprendizaje**: Seguimiento de conceptos a traves de sesiones
- **Contenido editable**: Todo el contenido en JSON/Markdown, manejado por Claude Code

## Estructura del Proyecto

```
ml2-master-game/
├── content/                    # Contenido editable (Claude Code es el "control room")
│   ├── courses/               # Configuracion de cursos
│   ├── sessions/              # Sesiones de juego (escenarios, rubricas)
│   └── judges/                # Configuracion de jueces AI
│
├── src/                       # Codigo React
│   ├── pages/
│   │   ├── student/          # Paginas de estudiantes
│   │   └── professor/        # Panel del profesor
│   ├── hooks/                # Hooks personalizados
│   ├── types/                # Tipos TypeScript
│   └── lib/                  # Utilidades (Firebase, etc.)
│
├── functions/                 # Cloud Functions (evaluacion AI)
│
├── CONTENT_GUIDE.md          # Guia para modificar contenido
└── firebase.json             # Configuracion Firebase
```

## Setup Rapido

### 1. Instalar dependencias

```bash
npm install
cd functions && npm install && cd ..
```

### 2. Configurar Firebase

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar Authentication (Google provider)
3. Habilitar Firestore
4. Actualizar `src/lib/firebase.ts` con tu configuracion

### 3. Configurar OpenAI

```bash
firebase functions:config:set openai.key="YOUR_OPENAI_KEY"
```

### 4. Desarrollo local

```bash
npm run dev
```

### 5. Deploy

```bash
# Frontend a GitHub Pages
npm run build
# Copiar dist/ a gh-pages branch

# Backend a Firebase
firebase deploy --only functions
firebase deploy --only firestore:rules
```

## Modificar Contenido

Todo el contenido del juego esta en la carpeta `content/`. Ver [CONTENT_GUIDE.md](./CONTENT_GUIDE.md) para instrucciones detalladas.

### Crear una nueva sesion

1. Crear carpeta en `content/sessions/{course}/session_N_{topic}/`
2. Crear `config.json`, `scenarios.json`, `rubric.json`, `knowledge_base.md`
3. El juego detectara automaticamente la nueva sesion

### Modificar escenarios

Editar `content/sessions/{session}/scenarios.json`

### Modificar rubricas

Editar `content/sessions/{session}/rubric.json`

## Arquitectura

- **Frontend**: React + TypeScript + Vite + TailwindCSS + Framer Motion
- **Backend**: Firebase (Firestore + Authentication + Cloud Functions)
- **AI**: OpenAI GPT-4 para evaluacion
- **Hosting**: GitHub Pages (frontend) + Firebase (backend)

## Licencia

Uso educativo - Universidad Adolfo Ibanez
