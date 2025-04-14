import React, { useState, useEffect } from "react"
import { Database } from "lucide-react"
import { vscode } from "../../utils/vscode"
import {
	VSCodeCheckbox,
	VSCodeTextField,
	VSCodeButton,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/webview-ui-toolkit/react"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"
import { SetCachedStateField } from "./types"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"
import { ApiConfiguration } from "../../../../src/shared/api"

interface CodeIndexSettingsProps {
	codeIndexEnabled: boolean
	codeIndexQdrantUrl: string
	codeIndexEmbedderType?: string
	codeIndexOllamaBaseUrl?: string
	codeIndexOllamaModelId?: string
	apiConfiguration: ApiConfiguration
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
	setApiConfigurationField: <K extends keyof ApiConfiguration>(field: K, value: ApiConfiguration[K]) => void
}

interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: {
		systemStatus: string
		message?: string
	}
}

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({
	codeIndexEnabled,
	codeIndexQdrantUrl,
	codeIndexEmbedderType = "openai",
	codeIndexOllamaBaseUrl = "http://localhost:11434",
	codeIndexOllamaModelId = "nomic-embed-text:latest",
	apiConfiguration,
	setCachedStateField,
	setApiConfigurationField,
}) => {
	const [systemStatus, setSystemStatus] = useState("Standby")
	const [indexingMessage, setIndexingMessage] = useState("")

	useEffect(() => {
		// Request initial indexing status from extension host
		vscode.postMessage({ type: "requestIndexingStatus" })

		// Set up interval for periodic status updates

		// Set up message listener for status updates
		const handleMessage = (event: MessageEvent<IndexingStatusUpdateMessage>) => {
			if (event.data.type === "indexingStatusUpdate") {
				setSystemStatus(event.data.values.systemStatus)
				setIndexingMessage(event.data.values.message || "")
			}
		}

		window.addEventListener("message", handleMessage)

		// Cleanup function
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [codeIndexEnabled])

	const handleEmbedderTypeChange = (e: any) => {
		setCachedStateField("codeIndexEmbedderType", e.target.value)
	}

	return (
		<>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Database size={16} />
					Codebase Indexing
				</div>
			</SectionHeader>
			<Section>
				<VSCodeCheckbox
					checked={codeIndexEnabled}
					onChange={(e: any) => setCachedStateField("codeIndexEnabled", e.target.checked)}>
					Enable Codebase Indexing
				</VSCodeCheckbox>

				{codeIndexEnabled && (
					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<VSCodeDropdown value={codeIndexEmbedderType} onChange={handleEmbedderTypeChange}>
								<VSCodeOption value="openai">OpenAI Embeddings</VSCodeOption>
								<VSCodeOption value="ollama">Ollama Embeddings</VSCodeOption>
							</VSCodeDropdown>
							<p className="text-sm text-vscode-descriptionForeground">Select embedding model provider</p>
						</div>

						{codeIndexEmbedderType === "openai" && (
							<div className="space-y-2">
								<VSCodeTextField
									type="password"
									value={apiConfiguration.codeIndexOpenAiKey || ""}
									onInput={(e: any) =>
										setApiConfigurationField("codeIndexOpenAiKey", e.target.value)
									}>
									OpenAI API Key (for Embeddings)
								</VSCodeTextField>
								<p className="text-sm text-vscode-descriptionForeground">
									Used to generate embeddings for code snippets.
								</p>
							</div>
						)}

						{codeIndexEmbedderType === "ollama" && (
							<>
								<div className="space-y-2">
									<VSCodeTextField
										value={codeIndexOllamaBaseUrl}
										onInput={(e: any) =>
											setCachedStateField("codeIndexOllamaBaseUrl", e.target.value)
										}>
										Ollama Base URL
									</VSCodeTextField>
									<p className="text-sm text-vscode-descriptionForeground">
										URL of your running Ollama instance (default: http://localhost:11434).
									</p>
								</div>
								<div className="space-y-2">
									<VSCodeTextField
										value={codeIndexOllamaModelId}
										onInput={(e: any) =>
											setCachedStateField("codeIndexOllamaModelId", e.target.value)
										}>
										Ollama Model ID
									</VSCodeTextField>
									<p className="text-sm text-vscode-descriptionForeground">
										Model to use for embeddings (default: nomic-embed-text:latest).
									</p>
								</div>
							</>
						)}

						<div className="space-y-2">
							<VSCodeTextField
								value={codeIndexQdrantUrl}
								onInput={(e: any) => setCachedStateField("codeIndexQdrantUrl", e.target.value)}>
								Qdrant URL
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								URL of your running Qdrant vector database instance.
							</p>
						</div>

						<div className="space-y-2">
							<VSCodeTextField
								type="password"
								value={apiConfiguration.codeIndexQdrantApiKey}
								onInput={(e: any) => setApiConfigurationField("codeIndexQdrantApiKey", e.target.value)}>
								Qdrant API Key
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								API key for authenticating with your Qdrant instance.
							</p>
						</div>

						<div className="text-sm text-vscode-descriptionForeground mt-4">
							<span
								className={`
									inline-block w-3 h-3 rounded-full mr-2
									${
										systemStatus === "Standby"
											? "bg-gray-400"
											: systemStatus === "Indexing"
												? "bg-yellow-500 animate-pulse"
												: systemStatus === "Indexed"
													? "bg-green-500"
													: systemStatus === "Error"
														? "bg-red-500"
														: "bg-gray-400"
									}
								`}></span>
							{systemStatus}
							{indexingMessage ? ` - ${indexingMessage}` : ""}
						</div>

						<div className="flex gap-2 mt-4">
							<VSCodeButton
								onClick={() => vscode.postMessage({ type: "startIndexing" })}
								disabled={
									(codeIndexEmbedderType === "openai" && !apiConfiguration.codeIndexOpenAiKey) ||
									!codeIndexQdrantUrl ||
									!apiConfiguration.codeIndexQdrantApiKey ||
									systemStatus === "Indexing"
								}>
								Start Indexing
							</VSCodeButton>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<VSCodeButton appearance="secondary">Clear Index Data</VSCodeButton>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Are you sure?</AlertDialogTitle>
										<AlertDialogDescription>
											This action cannot be undone. This will permanently delete your codebase
											index data.
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => vscode.postMessage({ type: "clearIndexData" })}>
											Clear Data
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					</div>
				)}
			</Section>
		</>
	)
}
