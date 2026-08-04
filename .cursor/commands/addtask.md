# Add Task - Subtask Implementation Loop

**CRITICAL: This workflow MUST be followed step-by-step in order. Do NOT skip steps or generate plans before completing prerequisite steps.**

This command implements a new subtask (child task) within an existing parent logs folder. The user will provide the goal/description of the subtask when invoking this command.

## Workflow

**MANDATORY: Follow these steps in exact order. Do not proceed to the next step until the current step is complete.**

1. **Read Context**: Check `ai/context/context.md` to understand the logs folder structure and current state

2. **Read Master Plan**: Read the current master plan specified in `ai/context/context.md`:

   - Current: `ai/plans/master/andrewos.master.plan.md`
   - This provides complete project context and todo list

3. **Identify Parent Folder**:

   - **If user references a specific logs folder** (e.g., `ai/logs/4/0/`), use the parent of that folder (`ai/logs/4/`) as the parent
   - Otherwise, review existing logs folders (`ai/logs/1/`, `ai/logs/2/`, etc.) to determine the most relevant parent folder for this subtask
   - Consider the relationship between the subtask goal and existing implementation phases
   - Select the parent folder that best matches the subtask's context and purpose
   - **STOP HERE**: Confirm the parent folder path before proceeding

4. **Create Subfolder** (MANDATORY BEFORE PLAN GENERATION):

   - **VERIFY**: Check if the selected parent folder already has subfolders (e.g., `ai/logs/2/1/`, `ai/logs/2/2/`, etc.)
   - **CREATE**:
     - If no subfolders exist, create subfolder `0` (e.g., `ai/logs/2/0/`)
     - If subfolders exist, find the highest numbered subfolder and increment by 1 (e.g., if highest is `ai/logs/2/3/`, create `ai/logs/2/4/`)
   - **VERIFY CREATION**: Confirm the subfolder exists using `list_dir` or similar tool
   - **CRITICAL**: Do NOT proceed to step 5 until this subfolder is created and verified
   - **Example**: If parent is `ai/logs/4/` and `ai/logs/4/0/` exists, create `ai/logs/4/1/`

5. **Create Implementation Plan**:

   - Generate a detailed implementation plan for the subtask based on the user-provided goal
   - Ensure the plan aligns with the master plan's technical specifications and project structure
   - Save the plan as a `.plan.md` file directly in the subfolder created in step 4 (e.g., `ai/logs/4/1/fix-port-configuration.plan.md`)

6. **Implement**:

   - Follow the implementation plan step by step
   - Create all necessary files, components, and configurations
   - Write clean, well-structured code following the master plan's technical specifications
   - Ensure code follows the project structure outlined in the master plan

7. **Test**:

   - Include verifiable testing steps in the implementation
   - If user testing/verification is required, pause and request user input
   - Document test results in the implementation log
   - Only proceed after tests pass or user confirms functionality

8. **Log Implementation** (MANDATORY FINAL STEP):
   - Create an implementation log `.md` file in the same subfolder as the plan (created in step 4)
   - Document what was implemented, any issues encountered, and test results
   - Include details about files modified, new files created, and any configuration changes
   - **VERIFY**: Confirm the implementation log is in the correct subfolder

## Important Rules

- **NEVER skip workflow steps**: Steps 1-8 must be completed in order
- **NEVER generate plans before creating subfolders**: Step 4 must complete before step 5
- **NEVER create new parent logs folders**: Only create subfolders within existing parent folders (`ai/logs/1/`, `ai/logs/2/`, etc.)
- **User-provided goal**: The subtask goal/description will be provided by the user when invoking this command - use this to guide plan creation
- **Never skip testing**: Always include verifiable testing steps, even if it requires user interaction
- **Follow the logs folder structure**: Always create new numbered subfolders within the selected parent folder
- **Respect user input**: When user testing is required, pause and wait for confirmation before continuing
- **Complete the subtask fully**: Focus on fully implementing and testing the subtask before completing
- **Document everything**: Create detailed plans and implementation logs for future reference
- **Use context.md**: Reference `ai/context/context.md` for project context and structure understanding
- **Subfolder first**: Always create the subfolder BEFORE generating the plan

## Project-Specific Paths

| Purpose             | Path                                      |
| ------------------- | ----------------------------------------- |
| Master Plan         | `ai/plans/master/andrewos.master.plan.md` |
| Implementation Logs | `ai/logs/[number]/`                       |
| Subtask Logs        | `ai/logs/[parent]/[subtask]/`             |
| Context File        | `ai/context/context.md`                   |

## Starting the Command

When this command is invoked, the user will provide the goal/description of the subtask. **You MUST immediately begin with step 1 and continue through the entire workflow in order until the subtask is complete or user intervention is required for testing.**

**Checklist before generating plan:**

- [ ] Context read (`ai/context/context.md`)
- [ ] Master plan reviewed (`ai/plans/master/andrewos.master.plan.md`)
- [ ] Parent folder identified
- [ ] Subfolder created and verified
- [ ] Ready to generate plan in subfolder
