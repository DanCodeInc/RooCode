import React from "react"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { CodeIndexToggleProps } from "../types"

/**
 * Component for toggling code indexing on/off
 */
export const CodeIndexToggle: React.FC<CodeIndexToggleProps> = ({ enabled, onChange }) => {
	return (
		<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
			Enable Codebase Indexing
		</VSCodeCheckbox>
	)
}
