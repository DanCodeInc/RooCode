import React, { useState, useEffect } from "react"
import { Database } from "lucide-react"
import { vscode } from "../../utils/vscode"
import { VSCodeCheckbox, VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { SetCachedStateField } from "./types"
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

interface CodeIndexSettingsProps {
	codeIndexEnabled: boolean
	codeIndexOpenAiKey: string
	codeIndexQdrantUrl: string
	setCachedStateField: SetCachedStateField<"codeIndexEnabled" | "codeIndexOpenAiKey" | "codeIndexQdrantUrl">
}

interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: {
		systemStatus: string
		message?: string
		processedFiles?: number
		skippedFiles?: number
		totalFiles?: number
		progressPercent?: number
	}
}

export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({
	codeIndexEnabled,
	codeIndexOpenAiKey,
	codeIndexQdrantUrl,
	setCachedStateField,
}) => {
	const [systemStatus, setSystemStatus] = useState("Standby")
	const [indexingMessage, setIndexingMessage] = useState("")
	const [processedFiles, setProcessedFiles] = useState(0)
	const [skippedFiles, setSkippedFiles] = useState(0)
	// We only need the setter function for totalFiles
	const [, setTotalFiles] = useState(0)
	const [progressPercent, setProgressPercent] = useState(0)

	useEffect(() => {
		if (!codeIndexEnabled) {
			// Reset all state values when indexing is disabled
			setSystemStatus("Standby")
			setIndexingMessage("")
			setProcessedFiles(0)
			setSkippedFiles(0)
			setTotalFiles(0)
			setProgressPercent(0)
			return
		}

		// Request initial indexing status from extension host
		vscode.postMessage({ type: "requestIndexingStatus" })

		// Set up interval for periodic status updates (every 5 seconds)
		const pollInterval = setInterval(() => {
			vscode.postMessage({ type: "requestIndexingStatus" })
		}, 5000)

		// Set up message listener for status updates
		const handleMessage = (event: MessageEvent<IndexingStatusUpdateMessage>) => {
			if (event.data.type === "indexingStatusUpdate") {
				const values = event.data.values

				// Update basic status
				setSystemStatus(values.systemStatus)
				setIndexingMessage(values.message || "")

				// Update file statistics if available
				if (values.processedFiles !== undefined) {
					setProcessedFiles(values.processedFiles)
				}

				if (values.skippedFiles !== undefined) {
					setSkippedFiles(values.skippedFiles)
				}

				if (values.totalFiles !== undefined) {
					setTotalFiles(values.totalFiles)
				}

				if (values.progressPercent !== undefined) {
					setProgressPercent(values.progressPercent)
				} else if (
					values.processedFiles !== undefined &&
					values.totalFiles !== undefined &&
					values.totalFiles > 0
				) {
					// Calculate progress percentage if not provided but we have processed and total counts
					const percent = Math.min(Math.round((values.processedFiles / values.totalFiles) * 100), 100)
					setProgressPercent(percent)
				}
			}
		}

		window.addEventListener("message", handleMessage)

		// Cleanup function
		return () => {
			clearInterval(pollInterval) // Clean up the polling interval
			window.removeEventListener("message", handleMessage)
		}
	}, [codeIndexEnabled])
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
							<VSCodeTextField
								type="password"
								value={codeIndexOpenAiKey}
								onInput={(e: any) => setCachedStateField("codeIndexOpenAiKey", e.target.value)}>
								OpenAI API Key (for Embeddings)
							</VSCodeTextField>
							<p className="text-sm text-vscode-descriptionForeground">
								Used to generate embeddings for code snippets.
							</p>
						</div>

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

						<div className="space-y-2 mt-4">
							{/* Status indicator */}
							<div className="text-sm text-vscode-descriptionForeground flex items-center">
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
								<span className="font-medium">{systemStatus}</span>
								{indexingMessage ? <span className="ml-2">{indexingMessage}</span> : ""}
							</div>

							{/* Progress bar - only show when indexing */}
							{systemStatus === "Indexing" && (
								<div className="space-y-1">
									<div className="w-full bg-vscode-input-background rounded-sm overflow-hidden h-1.5">
										<div
											className="bg-yellow-500 h-full transition-all duration-300 ease-in-out"
											style={{ width: `${progressPercent}%` }}></div>
									</div>
									<div className="flex justify-between text-xs text-vscode-descriptionForeground">
										<span>{progressPercent}% complete</span>
										<span>
											{processedFiles} processed, {skippedFiles} skipped
										</span>
									</div>
								</div>
							)}

							{/* Error details - only show when there's an error */}
							{systemStatus === "Error" && indexingMessage && (
								<div className="text-xs text-red-500 bg-red-500 bg-opacity-10 p-2 rounded border border-red-500 border-opacity-20">
									{indexingMessage}
								</div>
							)}

							{/* Success details - only show when indexed */}
							{systemStatus === "Indexed" && (
								<div className="text-xs text-vscode-descriptionForeground">
									Total files indexed: {processedFiles + skippedFiles}
								</div>
							)}
						</div>

						<div className="flex gap-2 mt-4">
							<VSCodeButton
								onClick={() => vscode.postMessage({ type: "startIndexing" })} // Added onClick
								disabled={!codeIndexOpenAiKey || !codeIndexQdrantUrl || systemStatus === "Indexing"} // Added disabled logic
							>
								Start Indexing {/* Reverted translation */}
							</VSCodeButton>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<VSCodeButton appearance="secondary">
										Clear Index Data {/* Reverted translation */}
									</VSCodeButton>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>Are you sure?</AlertDialogTitle> {/* Reverted translation */}
										<AlertDialogDescription>
											This action cannot be undone. This will permanently delete your codebase
											index data. {/* Reverted translation */}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>Cancel</AlertDialogCancel> {/* Reverted translation */}
										<AlertDialogAction
											// Removed variant="destructive"
											onClick={() => vscode.postMessage({ type: "clearIndexData" })} // Added onClick
										>
											Clear Data {/* Reverted translation */}
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
