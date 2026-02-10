# Judges Directory

This directory contains the configuration for AI judges that evaluate student responses.

## How It Works

1. Each session specifies which judges to use in its `config.json`
2. Judges are defined here with their personality, evaluation style, and prompt template
3. During evaluation, each judge receives:
   - The session's `knowledge_base.md`
   - The session's `reference_docs/` content
   - The session's `rubric.json`
   - The scenario's `idealAnswer`
   - The student's response

## File: `default_judges.json`

Contains the default judge configurations used across sessions.

### Judge Structure

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

### Fields Explained

- **judgeId**: Unique identifier referenced in session configs
- **name**: Display name shown to students
- **personality**: Background and expertise description
- **evaluationStyle**: How this judge approaches evaluation
- **promptTemplate**: The system prompt template (uses variables like {{rubric}}, {{knowledgeBase}})

## Available Judges

### 1. Technical Expert (`technical_expert`)
- **Role**: Evaluates technical accuracy
- **Focus**: Correct understanding of LLM concepts, architecture, terminology
- **Style**: Rigorous, detail-oriented

### 2. Public Sector Expert (`public_sector`)
- **Role**: Evaluates practical application
- **Focus**: Viability in government context, consideration of constraints
- **Style**: Pragmatic, context-aware

### 3. Professor Twin (`professor_twin`)
- **Role**: Evaluates overall learning demonstration
- **Focus**: Critical thinking, synthesis of concepts, academic rigor
- **Style**: Supportive but demanding

## Customizing Judges

To modify a judge's behavior:
1. Edit the `personality` for background changes
2. Edit the `evaluationStyle` for focus changes
3. Edit the `promptTemplate` for prompt engineering

## Adding New Judges

1. Add a new object to the `judges` array in `default_judges.json`
2. Give it a unique `judgeId`
3. Reference it in session `config.json` files

## Judge Weights

Each session can assign different weights to judges. Example from session config:

```json
"judges": [
  { "judgeId": "technical_expert", "weight": 0.35 },
  { "judgeId": "public_sector", "weight": 0.35 },
  { "judgeId": "professor_twin", "weight": 0.30 }
]
```

The weights must sum to 1.0. Adjust based on session focus:
- More technical session → increase `technical_expert` weight
- More applied session → increase `public_sector` weight

## Template Variables

The `promptTemplate` can use these variables (replaced at runtime):

| Variable | Content |
|----------|---------|
| `{{rubric}}` | Full rubric.json content |
| `{{knowledgeBase}}` | Full knowledge_base.md content |
| `{{referenceDocs}}` | Concatenated reference_docs/*.md |
| `{{scenario}}` | Current scenario object |
| `{{idealAnswer}}` | The idealAnswer from scenario |
| `{{studentResponse}}` | The student's submitted answer |
| `{{conceptTags}}` | Relevant concept tags for this scenario |
