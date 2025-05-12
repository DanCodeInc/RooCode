import { ToolArgs } from "./types"

export function getReadFileDescription(args: ToolArgs): string {
	return `## read_file

Description: Request to read the contents of a file at the specified path. When using this tool to gather information, it's your responsibility to ensure you have the COMPLETE context. Specifically, each time you call this tool you should:

1. Assess if the contents you viewed are sufficient to proceed with your task.
2. Take note of where there are lines not shown.
3. If the file contents you have viewed are insufficient, and you suspect they may be in lines not shown, proactively call the tool again to view those lines.
4. When in doubt, call this tool again to gather more information. Remember that partial file views may miss critical dependencies, imports, or functionality.

In some cases, if reading a range of lines is not enough, you may choose to read the entire file.
Reading entire files is often wasteful and slow, especially for large files (i.e. more than a few hundred lines). So you should use this option sparingly. The output of this tool call will be the 1-indexed file contents. By specifying start_line and end_line parameters, you can efficiently read specific portions of large files without loading the entire file into memory.

Use this to examine specific file contents _after_ identifying relevant files via other tools or user direction.

Parameters:

- path (required): The path of the file to read (relative to the current working directory ${args.cwd.toPosix()})
- start_line (optional): The starting line number to read from (1-based). If not provided, it starts from the beginning of the file.
- end_line (optional): The ending line number to read to (1-based, inclusive). If not provided, it reads to the end of the file or to the limit of total lines for this tool.

Usage:
<read_file>
<path>File path here</path>
<start_line>Starting line number (optional)</start_line>
<end_line>Ending line number, inclusive (optional)</end_line>
</read_file>`
}
