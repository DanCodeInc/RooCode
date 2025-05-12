import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command

Description: Request to execute a command on the system. This tool is useful to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does.
For command chaining, use the appropriate chaining syntax for the user's shell. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. When suggesting a command, prefer relative paths, e.g: \`touch ./path/to/file\`. If directed by the user, you may open a terminal in a different directory by using the \`cwd\` parameter.
When generating a command always assume you are on the workspace root directory ('${args.cwd.toPosix()}'). You might change directories in your command if needed, but you must change directories directly in the command itself and not with a separate tool call.

Parameters:

- command: (required) The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.
- cwd: (optional) The working directory to execute the command in (default: ${args.cwd.toPosix()})
  Usage:
  <execute_command>
  <command>Your command here</command>
  <cwd>Working directory path (optional)</cwd>
  </execute_command>

Example: Requesting to execute ls in a specific directory if directed
<execute_command>
<command>ls -la</command>
<cwd>/home/user/projects</cwd>
</execute_command>`
}
