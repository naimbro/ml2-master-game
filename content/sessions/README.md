# Sessions Directory

Each session represents one game play session (typically one class).
Sessions are organized by course.

## Structure

```
sessions/
└── {course-id}/
    └── session_N_{topic}/
        ├── README.md           # Session overview
        ├── config.json         # Round count, duration, tags
        ├── scenarios.json      # The questions/scenarios
        ├── rubric.json         # Evaluation criteria
        ├── knowledge_base.md   # Course material for AI judges
        └── reference_docs/     # Papers, lecture notes, readings
```

## Creating a New Session

### Step 1: Create the folder
```
mkdir content/sessions/{course}/session_N_{topic}
mkdir content/sessions/{course}/session_N_{topic}/reference_docs
```

### Step 2: Create config.json
```json
{
  "sessionId": "session_1_llm_fundamentals",
  "title": "Fundamentos de LLMs",
  "roundCount": 4,
  "roundDurationSeconds": 300,
  "conceptTags": ["transformers", "attention", "tokenization"],
  "judges": [
    { "judgeId": "technical_expert", "weight": 0.35 },
    { "judgeId": "public_sector", "weight": 0.35 },
    { "judgeId": "professor_twin", "weight": 0.30 }
  ]
}
```

### Step 3: Create scenarios.json
Array of scenario objects (see session_1 for example format)

### Step 4: Create rubric.json
Define evaluation dimensions and levels (see session_1 for example)

### Step 5: Create knowledge_base.md
Write the course content that AI judges should know

### Step 6: Add reference_docs/
Add paper excerpts, lecture notes, etc.

## Tips

- **Round count** should match number of scenarios
- **Concept tags** should align with scenarios and rubric
- **Knowledge base** should cover all concepts tested
- **Reference docs** should be excerpts, not full papers
