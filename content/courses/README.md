# Courses Directory

Each subdirectory represents a course that can use the ML2 Master Game.

## Structure

```
courses/
└── {course-id}/
    ├── README.md       # Course overview
    ├── config.json     # Course metadata
    └── enrolled.json   # Student enrollment list
```

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
