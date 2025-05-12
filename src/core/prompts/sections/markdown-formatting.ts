export function markdownFormattingSection(): string {
	return `<markdown>
In all responses, format any code constructs or filenames as clickable links. e.g [\`element\`](path/to/file.ext:line-number) only if the path and line numbers are known.
- The line number is required for syntax references and optional for filenames.
- This applies to all Markdown responses and those in the <attempt_completion> tool.

</markdown>`
}
