# Do Task - Complete Implementation Loop

This command implements the andrewOS master plan in a continuous loop, only pausing for user testing/verification when necessary.

## Workflow

1. **Read Context**: Check `ai/context/context.md` to understand the logs folder structure and current state
2. **Read Master Plan**: Read the current master plan file specified in `ai/context/context.md`:
   - Current: `ai/plans/master/andrewos.master.plan.md`
   - This provides complete project context and todo list
3. **Check Progress**:
   - Review existing logs folders (`ai/logs/1/`, `ai/logs/2/`, etc.) to see what's been implemented
   - Check the master plan's `todos` section (in the YAML frontmatter) to identify completed vs remaining items
   - Match log folder contents to todo items where possible
   - Identify the next uncompleted todo item (status: `pending`)
4. **Create Implementation Plan**:
   - Check the "Current Logs Folder" number in `ai/context/context.md`
   - Create a new numbered folder: `ai/logs/[next_number]/`
   - Generate a detailed implementation plan for the next todo item
   - Save the plan as a `.plan.md` or `.md` file in the newly created folder
   - Update the "Current Logs Folder" in `ai/context/context.md` to the new number
5. **Implement**:
   - Follow the implementation plan step by step
   - Create all necessary files, components, and configurations
   - Write clean, well-structured code following the master plan's technical specifications
   - Ensure code follows the project structure outlined in the master plan
6. **Test**:
   - Include verifiable testing steps in the implementation
   - If user testing/verification is required, pause and request user input
   - Document test results in the implementation log
   - Only proceed after tests pass or user confirms functionality
7. **Log Implementation**:
   - Create an implementation log `.md` file in the same numbered folder as the plan
   - Document what was implemented, any issues encountered, and test results
   - Update the corresponding todo item status to `completed` in the master plan (in the YAML frontmatter)
8. **STOP AND WAIT**:
   - **CRITICAL**: After completing ONE todo item, STOP and wait for user confirmation
   - Do NOT automatically proceed to the next todo
   - Only continue to the next todo if the user explicitly requests it or confirms the current implementation is complete
   - If user wants to continue, return to step 3 to identify the next uncompleted todo

## Important Rules

- **Never skip testing**: Always include verifiable testing steps, even if it requires user interaction
- **Follow the logs folder structure**: Always create new numbered folders in `ai/logs/` and update `ai/context/context.md` when creating plans
- **Respect user input**: When user testing is required, pause and wait for confirmation before continuing
- **Complete one todo at a time**: Focus on fully implementing and testing ONE item before moving to the next. STOP after each todo completion and wait for user confirmation before proceeding.
- **Never auto-continue**: Do NOT automatically proceed to the next todo after completing one. Always stop and wait for explicit user confirmation or request to continue.
- **Update context**: Always keep `ai/context/context.md` updated with the current logs folder number
- **Update master plan todos**: Mark todos as `completed` in the master plan's YAML frontmatter after successful implementation
- **Document everything**: Create detailed plans and implementation logs for future reference

## Project-Specific Paths

| Purpose             | Path                                      |
| ------------------- | ----------------------------------------- |
| Master Plan         | `ai/plans/master/andrewos.master.plan.md` |
| Implementation Logs | `ai/logs/[number]/`                       |
| Context File        | `ai/context/context.md`                   |

## Starting the Loop

When this command is invoked, immediately begin with step 1 and complete ONE todo item (steps 3-7), then STOP and wait for user confirmation before proceeding to the next todo. Do NOT attempt to complete all todos in a single run.
