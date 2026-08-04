# Push to GitHub

Publish local work to GitHub with one command. Handles commit, branch sync, merges, conflicts, and squash merges automatically.

**Read and follow the `push` skill** (`~/.cursor/skills/push/SKILL.md`) — begin immediately at Step 1 and run through Step 6 without asking unless blocked on auth or ambiguous conflicts.

## What /push does

1. Assess git state and fetch remote
2. Commit uncommitted work (excluding secrets and debug logs)
3. Sync with remote — pull, merge feature branches, squash agent branches when appropriate
4. Resolve merge conflicts
5. Push to GitHub
6. Report branch, commit SHA, and repo URL

## Rules

- Do everything yourself — do not hand git commands back to the user
- Committing is implied when pushing
- Never force-push `main`
- Minimize questions; infer sensible defaults
