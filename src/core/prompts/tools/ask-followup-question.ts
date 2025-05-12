export function getAskFollowupQuestionDescription(): string {
	return `## ask_followup_question

Description:
Ask the user a question to gather additional information. This tool should be used when you encounter ambiguities, need clarification, require more details to proceed effectively or you cannot find a relevant tool to use. Use this tool to provide the user with options to choose from, allowing them to provide figure out the next step in the task and for you to figure out the user's intent.

Parameters:

- question: (required) The question to ask the user. This should be a clear, specific question that addresses the information you need.
- follow_up: (required) A list of 2-4 suggested answers that logically follow from the question, ordered by priority or logical sequence. Each suggestion must:
    1. Be provided in its own <suggest> tag
    2. Be specific, actionable, and directly related to the completed task
    3. Be a complete answer to the question - the user should not need to provide additional information or fill in any missing details.
       Usage:
       <ask_followup_question>
       <question>Your question here</question>
       <follow_up>
       <suggest>
       Your suggested answer here
       </suggest>
       </follow_up>
       </ask_followup_question>`
}
