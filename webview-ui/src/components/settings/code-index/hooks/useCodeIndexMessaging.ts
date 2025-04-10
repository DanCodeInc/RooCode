import { useEffect } from "react"
import { vscode } from "../../../../utils/vscode"
import { IndexingStatusUpdateMessage } from "../types"

/**
 * Custom hook to handle messaging with the extension host
 */
export function useCodeIndexMessaging(
	enabled: boolean,
	onStatusUpdate: (
		status: string,
		message: string,
		processedFiles: number,
		skippedFiles: number,
		totalFiles: number,
		progressPercent: number,
	) => void,
) {
	useEffect(() => {
		if (!enabled) {
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

				// Update status with values from the message
				onStatusUpdate(
					values.systemStatus,
					values.message || "",
					values.processedFiles || 0,
					values.skippedFiles || 0,
					values.totalFiles || 0,
					values.progressPercent || 0,
				)
			}
		}

		window.addEventListener("message", handleMessage)

		// Cleanup function
		return () => {
			clearInterval(pollInterval)
			window.removeEventListener("message", handleMessage)
		}
	}, [enabled, onStatusUpdate])

	// Functions to send messages to the extension
	const startIndexing = () => {
		vscode.postMessage({ type: "startIndexing" })
	}

	const clearIndexData = () => {
		vscode.postMessage({ type: "clearIndexData" })
	}

	return {
		startIndexing,
		clearIndexData,
	}
}
