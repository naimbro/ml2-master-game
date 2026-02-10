# Content Directory

This directory contains all editable content for the ML2 Master Game.
**Claude Code is the primary tool for managing this content** - no web UI needed.

## Directory Structure

```
content/
├── courses/              # Course configurations and enrollments
│   └── ml2-2025/        # ML2 course for 2025
├── sessions/            # Session content (scenarios, rubrics, knowledge base)
│   └── ml2-2025/        # Sessions for ML2 course
│       └── session_1_llm_fundamentals/
└── judges/              # AI judge configurations
```

## Quick Reference for Claude Code

### Create a new session:
1. Create folder: `content/sessions/{course}/session_N_{name}/`
2. Create files: `config.json`, `scenarios.json`, `rubric.json`, `knowledge_base.md`
3. Create `reference_docs/` folder for papers/readings

### Modify a rubric:
1. Edit `content/sessions/{course}/{session}/rubric.json`
2. Adjust dimension weights (must sum to 1.0)

### Add reference documents:
1. Create markdown file in `content/sessions/{course}/{session}/reference_docs/`
2. Include relevant excerpts from papers, lecture notes, etc.

### Configure judges:
1. Edit `content/judges/default_judges.json`
2. Customize prompt templates, weights, and personalities

## File Formats

- **JSON** for structured data (config, scenarios, rubric, judges)
- **Markdown** for prose (knowledge base, reference docs, READMEs)

See `CONTENT_GUIDE.md` in the project root for detailed documentation.
