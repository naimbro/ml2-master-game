# ML2 Master Game - Content Guide

This guide explains how to manage game content using Claude Code. All content is stored in simple JSON and Markdown files that Claude Code can edit directly.

---

## Quick Reference

| Task | Command |
|------|---------|
| Create new session | Create folder + files in `content/sessions/{course}/` |
| Modify scenarios | Edit `scenarios.json` in session folder |
| Update rubric | Edit `rubric.json` in session folder |
| Add reference docs | Add `.md` files to `reference_docs/` |
| Configure judges | Edit `content/judges/default_judges.json` |
| Enroll students | Edit `content/courses/{course}/enrolled.json` |

---

## Directory Structure

```
content/
├── README.md               # Overview of content system
│
├── courses/                # Course configurations
│   └── {course-id}/
│       ├── README.md       # Course documentation
│       ├── config.json     # Course settings
│       └── enrolled.json   # Student enrollment
│
├── sessions/               # Game sessions (one per class)
│   ├── README.md           # How to create sessions
│   └── {course-id}/
│       └── session_N_{topic}/
│           ├── README.md           # Session overview
│           ├── config.json         # Rounds, timing, judges
│           ├── scenarios.json      # Questions/scenarios
│           ├── rubric.json         # Evaluation criteria
│           ├── knowledge_base.md   # Course material for AI
│           └── reference_docs/     # Papers, lectures
│
└── judges/                 # Judge configurations
    ├── README.md           # Judge system docs
    └── default_judges.json # Judge personalities
```

---

## Creating a New Session

### Step 1: Create the folder structure

```
content/sessions/{course}/session_N_{topic}/
├── README.md
├── config.json
├── scenarios.json
├── rubric.json
├── knowledge_base.md
└── reference_docs/
```

### Step 2: Create config.json

```json
{
  "sessionId": "session_2_apis",
  "title": "APIs y Llamadas a LLMs",
  "description": "Uso de APIs comerciales y manejo de respuestas",
  "date": "2025-03-20",
  "roundCount": 4,
  "roundDurationSeconds": 300,
  "bufferSeconds": 120,
  "conceptTags": ["api_calls", "tokens", "rate_limiting", "error_handling"],
  "judges": [
    { "judgeId": "technical_expert", "weight": 0.35 },
    { "judgeId": "public_sector", "weight": 0.35 },
    { "judgeId": "professor_twin", "weight": 0.30 }
  ]
}
```

**Fields:**
- `roundCount`: Should match number of scenarios
- `roundDurationSeconds`: Time per round (300 = 5 minutes)
- `bufferSeconds`: Time between rounds for results
- `conceptTags`: Tags for analytics tracking
- `judges`: Which judges to use and their weights (must sum to 1.0)

### Step 3: Create scenarios.json

```json
[
  {
    "id": "s2_scenario_1",
    "order": 1,
    "title": "El Limite de Tokens",
    "category": "Manejo de APIs",
    "difficulty": "medium",
    "context": "Tu equipo desarrolla un sistema que procesa...",
    "question": "Explica como manejarias el limite de tokens...",
    "conceptTags": ["tokens", "chunking", "api_calls"],
    "idealAnswer": {
      "keyPoints": [
        "Menciona estrategias de chunking",
        "Considera costos por token"
      ],
      "expectedConcepts": ["chunking", "token_limits"],
      "commonMistakes": [
        "Ignorar costos de tokens",
        "No considerar latencia"
      ],
      "excellentResponseIndicators": [
        "Propone cache para respuestas comunes",
        "Menciona retry con backoff"
      ]
    }
  }
]
```

**Scenario Fields:**
- `id`: Unique identifier (format: `s{N}_scenario_{M}`)
- `order`: Display order (1-indexed)
- `title`: Short, descriptive title
- `category`: Topic category for grouping
- `difficulty`: `easy`, `medium`, or `hard`
- `context`: Background information (1-2 paragraphs)
- `question`: The actual question to answer
- `conceptTags`: Concepts tested (for analytics)
- `idealAnswer`: Reference for AI judges (not shown to students)

#### Multiple-choice rounds

A scenario with `"type": "multiple_choice"` is a Kahoot-style block instead of an
open question. It is scored on the client and never reaches the AI judges.

```json
{
  "id": "s1_mc_conceptos",
  "order": 2,
  "title": "Kahoot: conceptos base",
  "type": "multiple_choice",
  "ranked": true,
  "durationSeconds": 77,
  "context": "",
  "question": "",
  "conceptTags": ["chunking"],
  "mcQuestions": [
    {
      "question": "El overlap en chunking sirve para:",
      "options": [
        { "id": "A", "text": "Reducir el tamano de los embeddings" },
        { "id": "B", "text": "Preservar contexto entre chunks" }
      ],
      "correctOptionIndex": 1,
      "timeLimitSeconds": 20,
      "explanation": "Se muestra tras responder (opcional)"
    }
  ]
}
```

- 2 to 4 options per question; `correctOptionIndex` is 0-based.
- `context` and `question` stay present-but-empty for legacy consumers.
- **`durationSeconds` is derived, not free-form.** The round timer must outlast
  the block or the host's auto-end cuts it off mid-question:

  ```
  durationSeconds = 12 (intro gate) + sum(timeLimitSeconds) + 5 * nQuestions + 15
  ```

  `src/lib/mcTiming.ts` is the source of truth; the session editor computes it
  for you, and `validate-content.cjs` fails the build if it is too small.

**Scoring** (`src/lib/mcScoring.ts`, unit-tested) puts MC on the same 0-100
six-anchor scale the judges use, so both round types feed one leaderboard:

| Outcome | Points |
|---|---|
| Correct | `70 + 30 x (fraction of time left)` -> 70..100 |
| Answered but wrong | 20 (the rubric's "intento y fallo" anchor) |
| No answer / timeout | 0 |

The block score is the sum divided by the **total** number of questions, not the
number answered. Correctness is worth 70 and speed at most 30, so a slow correct
answer always beats a fast wrong one and speed can never dominate the ranking.

> Changed 2026-07-26 (was `80 + 20 x speed`, wrong = 0, divided by answered).
> Only affects games created after that date — scores are snapshotted per game.

#### Images and audio

Any scenario, MC question, or MC option can carry media. All fields are optional
and legacy content is unaffected.

```json
"media": [
  { "kind": "image", "src": "media/mi-curso/foto.jpg",
    "alt": "Texto que se muestra si la imagen falla", "credit": "Autor - licencia" },
  { "kind": "audio", "src": "media/mi-curso/clip.mp3", "alt": "Descripcion" }
]
```

On an MC option instead: `imageSrc`, `imageAlt`, `imageCredit`.

Rules the validator enforces:

- Put files in `public/media/<curso>/` and reference them **without** a leading
  slash. The app is served from `/ml2-master-game/` on GitHub Pages, so `/media/x.jpg`
  resolves to the domain root and 404s **in production only** — never in `npm run dev`.
  Absolute `https://` URLs are allowed and passed through untouched.
- Images require `alt`; it is what the player sees if the file fails to load.
- Use **`.mp3`, not `.ogg`** — iOS Safari cannot play Ogg Vorbis and students are on phones.
- Audio never autoplays and stops the host's background music when played.

### Step 4: Create rubric.json

```json
{
  "sessionId": "session_2_apis",
  "globalInstructions": "Evalua considerando el contexto de sector publico...",
  "dimensions": [
    {
      "id": "technical_accuracy",
      "name": "Precision Tecnica",
      "weight": 0.35,
      "description": "Comprension correcta de conceptos",
      "levels": [
        { "score": 100, "label": "Excepcional", "indicators": ["..."] },
        { "score": 80, "label": "Competente", "indicators": ["..."] },
        { "score": 60, "label": "En Desarrollo", "indicators": ["..."] },
        { "score": 40, "label": "Insuficiente", "indicators": ["..."] },
        { "score": 20, "label": "No Demuestra", "indicators": ["..."] }
      ]
    }
  ],
  "bonusIndicators": ["Extra points for these..."],
  "penaltyIndicators": ["Penalize for these..."]
}
```

### Step 5: Create knowledge_base.md

Write the course content that AI judges should know. Include:
- Key concepts and definitions
- Expected responses per scenario
- Common mistakes to penalize
- Level of rigor expected

### Step 6: Add reference_docs/

Place excerpts from papers, lecture notes, or readings that students should have studied. The AI judges will use these to evaluate responses.

---

## Modifying Content

### Changing a scenario

1. Open `scenarios.json` in the session folder
2. Find the scenario by `id` or `order`
3. Edit the desired fields
4. Save the file

### Adjusting the rubric

1. Open `rubric.json` in the session folder
2. Modify dimension weights, levels, or indicators
3. Ensure weights still sum to 1.0

### Adding reference material

1. Create a new `.md` file in `reference_docs/`
2. Use descriptive naming: `paper_rag_survey.md`, `lecture_week3.md`
3. Include relevant excerpts (not full papers)

### Changing judge weights

1. Open the session's `config.json`
2. Modify the `weight` values in the `judges` array
3. Ensure weights sum to 1.0

---

## Managing Courses

### Creating a new course

1. Create folder: `content/courses/{course-id}/`
2. Create `config.json`:

```json
{
  "courseId": "ml2-2026",
  "name": "Machine Learning II - 2026",
  "code": "ML2-2026",
  "professorId": "professor-uid",
  "professorEmail": "professor@email.com",
  "startDate": "2026-03-01",
  "endDate": "2026-07-15",
  "sessions": []
}
```

3. Create `enrolled.json`:

```json
{
  "students": []
}
```

### Enrolling students

Edit `enrolled.json`:

```json
{
  "students": [
    {
      "email": "student1@uai.cl",
      "name": "Maria Garcia",
      "enrolledAt": "2025-03-01"
    },
    {
      "email": "student2@uai.cl",
      "name": "Juan Perez",
      "enrolledAt": "2025-03-01"
    }
  ]
}
```

---

## Judge Configuration

### Modifying judge personalities

Edit `content/judges/default_judges.json`:

```json
{
  "judges": [
    {
      "judgeId": "technical_expert",
      "name": "Dr. Tech",
      "personality": "...",
      "evaluationStyle": "...",
      "promptTemplate": "..."
    }
  ]
}
```

### Adding a new judge

1. Add a new object to the `judges` array
2. Give it a unique `judgeId`
3. Define personality, style, and prompt template
4. Reference it in session configs

---

## Best Practices

### Scenario Design

1. **Context first**: Provide rich, realistic context
2. **Open questions**: Avoid yes/no questions
3. **Multiple concepts**: Each scenario should test 2-3 concepts
4. **Public sector focus**: Ground scenarios in Chilean government context
5. **Difficulty progression**: Start easier, increase complexity

### Rubric Design

1. **Clear indicators**: Specific, observable behaviors
2. **Balanced weights**: Don't over-weight any dimension
3. **Avoid overlap**: Dimensions should be distinct
4. **Calibrate levels**: Ensure score ranges make sense

### Knowledge Base

1. **Comprehensive**: Cover all concepts that might be tested
2. **Structured**: Use clear headings and sections
3. **Example-rich**: Include concrete examples
4. **Error-aware**: List common mistakes explicitly

### Reference Documents

1. **Excerpts only**: Don't include full papers
2. **Relevant sections**: Only what students should know
3. **Consistent formatting**: Use Markdown consistently
4. **Attribution**: Include source information

---

## Troubleshooting

### "Judge not found" error
- Check that `judgeId` in session config matches one in `default_judges.json`

### Inconsistent scoring
- Review `knowledge_base.md` for ambiguity
- Ensure `idealAnswer` is comprehensive
- Check judge `promptTemplate` for clarity

### Students complaining about fairness
- Review `rubric.json` indicators
- Ensure scenarios have clear expectations
- Check that `commonMistakes` are truly mistakes

---

## Content Checklist

Before deploying a session, verify:

- [ ] `config.json` has correct `roundCount` matching scenarios
- [ ] `scenarios.json` has all scenarios with complete `idealAnswer`
- [ ] `rubric.json` dimension weights sum to 1.0
- [ ] `knowledge_base.md` covers all `conceptTags`
- [ ] `reference_docs/` contains relevant materials
- [ ] Judge weights in config sum to 1.0
- [ ] All `conceptTags` are consistent across files
