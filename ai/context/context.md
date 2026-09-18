# andrewOS Project Context

This file tracks the current state of the andrewOS implementation.

## Current Logs Folder

**7**

_(Increment this number when creating a new logs folder)_

Active implementation folder: `ai/logs/7/` — vibe-pan-sensitivity (completed)

**Latest session log (start here):** `ai/web/logs/2026-09-18-thank-you-typewriter-handoff.md`

## Current Master Plan

**ai/plans/master/andrewos.master.plan.md**

## Project Structure Reference

- **Master Plan**: `ai/plans/master/andrewos.master.plan.md` - The main project plan with todos and technical specifications
- **Implementation Logs**: `ai/logs/[number]/` - Numbered folders containing implementation plans and logs
- **Session handoffs**: `ai/web/logs/` - Cross-chat pickup notes
- **Context**: `ai/context/` - This folder, containing project state tracking

## Logs Folder Convention

Each numbered folder in `ai/logs/` represents one implementation session or task:

| Folder | Description             |
| ------ | ----------------------- |
| 1      | (First implementation)  |
| 2      | (Second implementation) |
| ...    | (Additional as needed)  |

## Notes

- The master plan's `todos` section tracks the overall project progress
- Each todo item should be implemented in its own logs folder with a plan and implementation log
- Always update "Current Logs Folder" after creating a new numbered folder
- Vibe arcade source lives in `~/Developer/Front End/vibecade`; `vibe/` here is build output only
- After vibecade source changes: `npm run build` in vibecade → copy `dist/assets/index.*.js` into `andrewos/vibe/assets/` → update only the script hash in `andrewos/vibe/index.html` (do not overwrite that HTML wholesale)
