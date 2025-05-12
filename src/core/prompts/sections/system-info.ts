import osName from "os-name"

import { getShell } from "../../../utils/shell"

export function getSystemInfoSection(cwd: string): string {
	let details = `The absolute path of the user's workspace is ${cwd.toPosix()}. The user's shell is ${getShell()}. The user's operating system is ${osName()}. The current year is 2025.
  
<environment_details>
At the start of a task and after user messages, you may receive \`environment_details\` (like file listings, running terminals). Use this passive information to inform your actions but don't assume it's a direct user request unless stated.

</environment_details>`

	return details
}
