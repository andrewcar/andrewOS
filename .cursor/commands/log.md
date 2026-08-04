# Log — Session Handoff

Clean up debug instrumentation and update handoff logs so work can resume in a new conversation.

**Read and follow the `log` skill** (`~/.cursor/skills/log/SKILL.md`) — begin immediately at Step 1 and run through Step 5.

## What /log does

1. Remove any session debug instrumentation if added
2. Assess what changed this session vs existing logs
3. Write or update handoff log(s) for cold pickup
4. Point `ai/context/context.md` at the latest session log
5. Report the handoff path and a pasteable next-chat prompt

## Intent

> good job. now remove any instrumentation if added and update the logs to reflect any changes so that I can pick up from where we left off in a new conversation

## Rules

- Cleanup + documentation only — do not start new feature work
- Do not commit or push unless also asked
- Handoff must be enough to resume without this chat
