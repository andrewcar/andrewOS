# New Master Plan - Update Project References

This command updates all relevant files and commands to reference a new master plan when the project's master plan changes.

## When to Use

Use this command when:
- You have created a new master plan file in `ai/plans/master/`
- The project direction has changed significantly
- You want to archive the old master plan and switch to a new one

## Workflow

1. **Identify New Master Plan**: The user will reference the new master plan file (e.g., `@ai/plans/master/new-plan.master.plan.md`)

2. **Read New Master Plan**: Read the new master plan to extract:
   - Project name from the `name` field in YAML frontmatter or document title
   - Full file path for references
   - Overview/description of the new plan

3. **Update Command Files**: Update all command files to reference the new master plan:
   - `.cursor/commands/dotask.md` - Update master plan path and project name references
   - `.cursor/commands/dosometasks.md` - Update master plan path, project name, and batch examples if relevant
   - `.cursor/commands/addtask.md` - Update master plan path in workflow and checklist
   - `.cursor/commands/push.md` - No changes (static; not tied to master plan)
   - `.cursor/commands/log.md` - No changes (static; uses global `log` skill)

4. **Update Context File**: Update `ai/context/context.md`:
   - Change the title to reflect the new project/phase name
   - Update the "Current Master Plan" path
   - Update "Project Structure Reference" paths
   - Add note about archived plans in `ai/plans/master/old/` if applicable
   - Increment the "Current Logs Folder" number to start fresh (optional, based on context)
   - Update the "Logs Folder Convention" table to note the transition

5. **Archive Old Master Plan** (if requested):
   - Move the old master plan to `ai/plans/master/old/`
   - Ensure the old plan is preserved for reference

6. **Verify All References**: Search the workspace for any remaining references to the old master plan and update them

## Files to Update

| File                               | Updates Required                                           |
| ---------------------------------- | ---------------------------------------------------------- |
| `.cursor/commands/dotask.md`       | Master plan path, project name in description              |
| `.cursor/commands/dosometasks.md`  | Master plan path, project name, batch examples             |
| `.cursor/commands/addtask.md`      | Master plan path in workflow and checklist                 |
| `.cursor/commands/push.md`         | No updates needed (static; uses global `push` skill)       |
| `.cursor/commands/log.md`          | No updates needed (static; uses global `log` skill)        |
| `ai/context/context.md`            | Title, master plan path, logs folder, notes                |

## Important Rules

- **Preserve old plans**: Move old master plans to `ai/plans/master/old/` rather than deleting them
- **Update all references**: Ensure no command files still reference the old master plan path
- **Increment logs folder**: Consider incrementing the logs folder number to clearly separate old work from new
- **Document the transition**: Add a note in `ai/context/context.md` explaining which logs folders belong to which master plan

## Starting the Command

When this command is invoked, the user will provide a reference to the new master plan. Read it, then systematically update all files listed above to use the new master plan as the source of truth.
