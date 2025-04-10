import { useState, useEffect } from "react"
import { IndexingSystemStatus } from "../types"
import { calculateProgressPercentage } from "../utils/statusHelpers"

/**
 * Custom hook to manage the indexing status state
 */
export function useCodeIndexStatus(enabled: boolean) {
	const [systemStatus, setSystemStatus] = useState<IndexingSystemStatus>("Standby")
	const [indexingMessage, setIndexingMessage] = useState("")
	const [processedFiles, setProcessedFiles] = useState(0)
	const [skippedFiles, setSkippedFiles] = useState(0)
	const [totalFiles, setTotalFiles] = useState(0)
	const [progressPercent, setProgressPercent] = useState(0)

	// Reset all state values when indexing is disabled
	useEffect(() => {
		if (!enabled) {
			setSystemStatus("Standby")
			setIndexingMessage("")
			setProcessedFiles(0)
			setSkippedFiles(0)
			setTotalFiles(0)
			setProgressPercent(0)
		}
	}, [enabled])

	// Update status values based on incoming data
	const updateStatus = (
		status: IndexingSystemStatus,
		message: string = "",
		processed: number = 0,
		skipped: number = 0,
		total: number = 0,
		progress: number = 0,
	) => {
		setSystemStatus(status)
		setIndexingMessage(message)
		setProcessedFiles(processed)
		setSkippedFiles(skipped)
		setTotalFiles(total)

		// Calculate progress if not provided but we have processed and total counts
		if (progress === 0 && total > 0) {
			setProgressPercent(calculateProgressPercentage(processed, total))
		} else {
			setProgressPercent(progress)
		}
	}

	return {
		systemStatus,
		indexingMessage,
		processedFiles,
		skippedFiles,
		totalFiles,
		progressPercent,
		updateStatus,
	}
}
