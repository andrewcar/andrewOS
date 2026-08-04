# Do Some Tasks - Batch Implementation Loop

This command implements the andrewOS master plan by completing 2-4 closely related todos in a single session. This batching approach is more token-efficient while maintaining the same implementation quality as single-task execution.

## Workflow

1. **Read Context**: Check `ai/context/context.md` to understand the logs folder structure and current state
2. **Read Master Plan**: Read the current master plan file specified in `ai/context/context.md`:
   - Current: `ai/plans/master/andrewos.master.plan.md`
   - This provides complete project context and todo list
3. **Check Progress and Select Batch**:
   - Review existing logs folders (`ai/logs/1/`, `ai/logs/2/`, etc.) to see what's been implemented
   - Check the master plan's `todos` section (in the YAML frontmatter) to identify completed vs remaining items
   - Identify **2-4 closely related** uncompleted todo items (status: `pending`) that make sense to implement together
   - Relatedness criteria: same feature area, shared dependencies, sequential workflow, or touching the same files
   - **State your selected batch** before proceeding (e.g., "Implementing: setup-project, install-deps, base-config")
4. **Create Implementation Plan**:
   - Check the "Current Logs Folder" number in `ai/context/context.md`
   - Create a new numbered folder: `ai/logs/[next_number]/`
   - Generate a **combined** detailed implementation plan covering all selected todos
   - Organize the plan to minimize redundant work (e.g., if multiple todos touch the same file, group those changes)
   - Save the plan as a `.plan.md` or `.md` file in the newly created folder
   - Update the "Current Logs Folder" in `ai/context/context.md` to the new number
5. **Implement**:
   - Follow the implementation plan step by step
   - Create all necessary files, components, and configurations
   - Write clean, well-structured code following the master plan's technical specifications
   - Ensure code follows the project structure outlined in the master plan
   - **Implement each todo fully** - batching is for efficiency, not for cutting corners
6. **Test**:
   - Include verifiable testing steps for **all todos in the batch**
   - If user testing/verification is required, pause and request user input
   - Document test results in the implementation log
   - Only proceed after tests pass or user confirms functionality
7. **Log Implementation**:
   - Create an implementation log `.md` file in the same numbered folder as the plan
   - Document what was implemented for **each todo**, any issues encountered, and test results
   - Update **all corresponding todo items** to `completed` in the master plan (in the YAML frontmatter)
8. **STOP AND WAIT**:
   - **CRITICAL**: After completing the batch, STOP and wait for user confirmation
   - Do NOT automatically proceed to the next batch
   - Only continue if the user explicitly requests it
   - If user wants to continue, return to step 3 to identify the next batch

## Important Rules

- **Never skip testing**: Always include verifiable testing steps for every todo in the batch
- **Follow the logs folder structure**: Always create new numbered folders in `ai/logs/` and update `ai/context/context.md` when creating plans
- **Respect user input**: When user testing is required, pause and wait for confirmation before continuing
- **Complete the batch fully**: Implement and test ALL todos in the selected batch before stopping. Each todo receives the same thorough implementation it would get in single-task mode.
- **Choose related todos**: Only batch todos that are genuinely related. If the next pending todos are unrelated, batch fewer (even just 2) rather than forcing unrelated work together.
- **Never auto-continue**: Do NOT automatically proceed to the next batch after completing one. Always stop and wait for explicit user confirmation.
- **Update context**: Always keep `ai/context/context.md` updated with the current logs folder number
- **Update master plan todos**: Mark ALL completed todos as `completed` in the master plan's YAML frontmatter after successful implementation
- **Document everything**: Create detailed plans and implementation logs for future reference

## Batch Selection Examples

**Good batches (related todos):**

- Setup tasks: `init-project` + `install-deps` + `base-config`
- UI components: `button-component` + `input-component` + `form-component`
- API integration: `api-client` + `auth-service` + `error-handling`

**Bad batches (unrelated todos):**

- `setup-database` + `ui-animations` (different feature areas)
- `auth-flow` + `deployment-config` (no shared context)

## Project-Specific Paths

| Purpose             | Path                                      |
| ------------------- | ----------------------------------------- |
| Master Plan         | `ai/plans/master/andrewos.master.plan.md` |
| Implementation Logs | `ai/logs/[number]/`                       |
| Context File        | `ai/context/context.md`                   |

## Starting the Loop

When this command is invoked, immediately begin with step 1, identify a batch of 2-4 related todos, complete them all (steps 3-7), then STOP and wait for user confirmation before proceeding to the next batch.
