import React from "react"
import { Database } from "lucide-react"
import { Section } from "../Section"
import { SectionHeader } from "../SectionHeader"
import { CodeIndexToggle } from "./components/CodeIndexToggle"
import { CodeIndexCredentials } from "./components/CodeIndexCredentials"
import { CodeIndexStatus } from "./components/CodeIndexStatus"
import { CodeIndexActions } from "./components/CodeIndexActions"
import { useCodeIndexStatus } from "./hooks/useCodeIndexStatus"
import { useCodeIndexMessaging } from "./hooks/useCodeIndexMessaging"
import { CodeIndexSettingsProps } from "./types"

/**
 * Main container component for code indexing settings
 */
export const CodeIndexSettings: React.FC<CodeIndexSettingsProps> = ({
	codeIndexEnabled,
	codeIndexOpenAiKey,
	codeIndexQdrantUrl,
	setCachedStateField,
}) => {
	// Use custom hooks for status management and messaging
	const { systemStatus, indexingMessage, processedFiles, skippedFiles, progressPercent, updateStatus } =
		useCodeIndexStatus(codeIndexEnabled)

	const { startIndexing, clearIndexData } = useCodeIndexMessaging(
		codeIndexEnabled,
		(status, message, processed, skipped, total, progress) => {
			updateStatus(status as any, message, processed, skipped, total, progress)
		},
	)

	// Handle toggle change
	const handleToggleChange = (enabled: boolean) => {
		setCachedStateField("codeIndexEnabled", enabled)
	}

	// Handle credential changes
	const handleOpenAiKeyChange = (key: string) => {
		setCachedStateField("codeIndexOpenAiKey", key)
	}

	const handleQdrantUrlChange = (url: string) => {
		setCachedStateField("codeIndexQdrantUrl", url)
	}

	// Determine if start button should be disabled
	const isStartDisabled = !codeIndexOpenAiKey || !codeIndexQdrantUrl || systemStatus === "Indexing"

	return (
		<>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Database size={16} />
					Codebase Indexing
				</div>
			</SectionHeader>
			<Section>
				<CodeIndexToggle enabled={codeIndexEnabled} onChange={handleToggleChange} />

				{codeIndexEnabled && (
					<div className="mt-4 space-y-4">
						<CodeIndexCredentials
							openAiKey={codeIndexOpenAiKey}
							qdrantUrl={codeIndexQdrantUrl}
							onOpenAiKeyChange={handleOpenAiKeyChange}
							onQdrantUrlChange={handleQdrantUrlChange}
						/>

						<div className="space-y-2 mt-4">
							<CodeIndexStatus
								systemStatus={systemStatus}
								message={indexingMessage}
								processedFiles={processedFiles}
								skippedFiles={skippedFiles}
								progressPercent={progressPercent}
							/>
						</div>

						<div className="mt-4">
							<CodeIndexActions
								onStartIndexing={startIndexing}
								onClearIndexData={clearIndexData}
								isStartDisabled={isStartDisabled}
							/>
						</div>
					</div>
				)}
			</Section>
		</>
	)
}
