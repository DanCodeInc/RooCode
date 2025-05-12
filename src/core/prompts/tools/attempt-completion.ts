export function getAttemptCompletionDescription(): string {
	return `## attempt_completion

Description: Use this tool to present a detailed summary and a conclusion of your work to the user once the task is complete. This tool should **only** be used after you have executed any necessary preceding tool calls and have received confirmation from the user that those actions were successful. After you use this tool, the user will review the result and may provide feedback for further refinement.
When a task is completed you may use this tool to present the final result to the user, the summary you provide is visible to the user, this means you should prefer including all the relevant information within the result parameter of the tool itself.
Using this tool prematurely, before confirming the success of required steps, will lead to presenting incomplete or incorrect results so this tool should only be used after the task has been completed correctly. Do not use this tool to tell the user that you are unable to complete the task or to ask questions.

Parameters

- result: (required) A clear, detailed and definitive summary describing the final outcome of the task. Present this as a statement of completion, avoiding questions or open-ended prompts for further assistance.
  Usage:
  <attempt_completion>
  <result>
  The conclusion summary of the task here
  </result>
  </attempt_completion>`
}
