import React from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { CodeIndexCredentialsProps } from "../types"

/**
 * Component for managing code indexing credentials
 */
export const CodeIndexCredentials: React.FC<CodeIndexCredentialsProps> = ({
	openAiKey,
	qdrantUrl,
	onOpenAiKeyChange,
	onQdrantUrlChange,
}) => {
	return (
		<>
			<div className="space-y-2">
				<VSCodeTextField
					type="password"
					value={openAiKey}
					onInput={(e: any) => onOpenAiKeyChange(e.target.value)}>
					OpenAI API Key (for Embeddings)
				</VSCodeTextField>
				<p className="text-sm text-vscode-descriptionForeground">
					Used to generate embeddings for code snippets.
				</p>
			</div>

			<div className="space-y-2">
				<VSCodeTextField value={qdrantUrl} onInput={(e: any) => onQdrantUrlChange(e.target.value)}>
					Qdrant URL
				</VSCodeTextField>
				<p className="text-sm text-vscode-descriptionForeground">
					URL of your running Qdrant vector database instance.
				</p>
			</div>
		</>
	)
}
