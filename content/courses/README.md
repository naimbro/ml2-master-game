# Courses Directory

Each subdirectory represents a course that can use the ML2 Master Game.

## Structure

```
courses/
└── {course-id}/
    ├── README.md              # Course overview
    ├── config.json            # Course metadata
    ├── enrolled.json          # Student enrollment list
    ├── judges.json            # OPTIONAL - only if the course needs NEW judges
    └── judge_overrides.json   # OPTIONAL - personas for the judges it reuses
```

## Judges

A course does **not** need `judges.json`. The judges shown in the professor UI
(`/professor/courses/:courseId/judges`) are derived from the `config.judges` each of the course's
sessions declares — the same list the backend evaluates against. So a course that reuses existing
judgeIds (as `mundial_2026` and `temas_emergentes_2026` do) gets its roster automatically, and so
does any course created from the frontend.

- `judges.json` — only for a course that needs genuinely **new** judges (new judgeIds, new
  provider/model/promptTemplate). judgeIds must be globally unique; seeded with
  `node scripts/seed-firestore.cjs`.
- `judge_overrides.json` — the usual path: give the judges the course reuses a course-specific
  persona (name, avatar, personality, evaluationStyle). Seeded with
  `node scripts/seed-judge-overrides.cjs <courseId>`. The professor can keep editing these from
  the UI; overrides are per-course, so the same judgeId wears a different persona in each course.

## Creating a New Course

1. Create a new folder with a unique course ID (e.g., `ml2-2025`, `demo-course`)
2. Copy the template files from an existing course
3. Update `config.json` with course details
4. The `enrolled.json` will be populated automatically when students enroll

## Course Config Example

```json
{
  "courseId": "ml2-2025",
  "name": "Machine Learning II - IA Generativa y Procesos Publicos",
  "code": "ML2-2025-1",
  "professorEmail": "naim.bro@gmail.com",
  "university": "Universidad Adolfo Ibanez",
  "program": "Magister en Economia y Politicas Publicas",
  "startDate": "2025-03-06",
  "endDate": "2025-04-24"
}
```
