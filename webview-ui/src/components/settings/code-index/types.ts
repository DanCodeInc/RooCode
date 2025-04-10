import { SetCachedStateField } from "../types"

/**
 * Props for the main CodeIndexSettings component
 */
export interface CodeIndexSettingsProps {
	codeIndexEnabled: boolean
	codeIndexOpenAiKey: string
	codeIndexQdrantUrl: string
	setCachedStateField: SetCachedStateField<"codeIndexEnabled" | "codeIndexOpenAiKey" | "codeIndexQdrantUrl">
}

/**
 * Message structure for indexing status updates from the extension
 */
export interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: IndexingStatusValues
}

/**
 * Values contained in an indexing status update
 */
export interface IndexingStatusValues {
	systemStatus: IndexingSystemStatus
	message?: string
	processedFiles?: number
	skippedFiles?: number
	totalFiles?: number
	progressPercent?: number
}

/**
 * Possible system statuses for the indexing process
 */
export type IndexingSystemStatus = "Standby" | "Indexing" | "Indexed" | "Error"

/**
 * Props for the CodeIndexToggle component
 */
export interface CodeIndexToggleProps {
	enabled: boolean
	onChange: (enabled: boolean) => void
}

/**
 * Props for the CodeIndexCredentials component
 */
export interface CodeIndexCredentialsProps {
	openAiKey: string
	qdrantUrl: string
	onOpenAiKeyChange: (key: string) => void
	onQdrantUrlChange: (url: string) => void
}

/**
 * Props for the CodeIndexStatus component
 */
export interface CodeIndexStatusProps {
	systemStatus: IndexingSystemStatus
	message: string
	processedFiles: number
	skippedFiles: number
	progressPercent: number
}

/**
 * Props for the CodeIndexActions component
 */
export interface CodeIndexActionsProps {
	onStartIndexing: () => void
	onClearIndexData: () => void
	isStartDisabled: boolean
}
