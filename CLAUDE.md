# CLAUDE.md - Project Instructions for Claude Code

## CRITICAL: Firebase Functions Deployment from WSL

**This project lives on the Windows filesystem (`/mnt/c/...`) but runs tools from WSL.**

WSL's cross-filesystem I/O to NTFS is extremely slow for Node.js module resolution. Loading `functions/lib/index.js` takes ~26 seconds from `/mnt/c/` vs ~0.3 seconds from native WSL filesystem. Firebase CLI has a 10-second discovery timeout, so **`firebase deploy --only functions` will ALWAYS fail when run directly from this project directory.**

### Solution: Deploy from native WSL filesystem

```bash
# 1. Copy source files (NOT node_modules) to /tmp
rm -rf /tmp/functions-deploy
mkdir -p /tmp/functions-deploy/functions

# 2. Copy firebase config
cp firebase.json /tmp/functions-deploy/
echo '{"projects":{"default":"ml2-master-game"}}' > /tmp/functions-deploy/.firebaserc

# 3. Copy the ENTIRE functions source + built output.
#    IMPORTANT: firebase.json has a `predeploy` hook (`npm run build` -> tsc) that
#    recompiles from source, and functions/src/index.ts imports several ./lib/*.ts
#    modules (scoring, judgeModels, judgeOverrides, ...). Copy the whole src tree
#    (NOT just index.ts) or the predeploy build fails on the missing lib sources.
cp functions/package.json functions/package-lock.json functions/tsconfig.json /tmp/functions-deploy/functions/
cp -r functions/src /tmp/functions-deploy/functions/src
cp -r functions/lib /tmp/functions-deploy/functions/lib

# 4. Install dependencies on native fs (fast)
cd /tmp/functions-deploy/functions && npm ci

# 5. Deploy from native fs (predeploy tsc runs here, then upload)
cd /tmp/functions-deploy && npx firebase deploy --only functions
```

**Do NOT attempt `firebase deploy` directly from `/mnt/c/...` - it will timeout every time.**

> Firestore rules deploy fine directly from the project dir (they don't load functions):
> `npx firebase deploy --only firestore:rules`.

## Project Overview

- **Stack**: React + TypeScript + Vite (frontend), Firebase Cloud Functions (backend), Firestore (database)
- **Firebase project**: `ml2-master-game`
- **Hosting**: GitHub Pages via GitHub Actions (push to `main` triggers deploy)
- **Functions region**: `us-central1`

## Build Commands

- Frontend: `npm run build` (from project root)
- Functions: `cd functions && npm run build`
- Frontend dev: `npm run dev`

## Key Directories

- `src/` - React frontend
- `functions/src/` - Cloud Functions (single file: `index.ts`)
- `content/sessions/` - Session content (scenarios, rubrics, knowledge bases)
- `functions/lib/` - Compiled JS output (committed to repo, needed for deploy)
