import { IndexingSystemStatus } from "../types"

/**
 * Get the CSS class for the status indicator based on the current system status
 */
export function getStatusIndicatorClass(status: IndexingSystemStatus): string {
	switch (status) {
		case "Standby":
			return "bg-gray-400"
		case "Indexing":
			return "bg-yellow-500 animate-pulse"
		case "Indexed":
			return "bg-green-500"
		case "Error":
			return "bg-red-500"
		default:
			return "bg-gray-400"
	}
}

/**
 * Calculate progress percentage based on processed and total files
 */
export function calculateProgressPercentage(processed: number, total: number): number {
	if (total <= 0 || processed < 0) {
		return 0
	}
	return Math.min(Math.round((processed / total) * 100), 100)
}

/**
 * Get a human-readable description of the indexing status
 */
export function getStatusDescription(status: IndexingSystemStatus): string {
	switch (status) {
		case "Standby":
			return "Ready to index"
		case "Indexing":
			return "Indexing in progress"
		case "Indexed":
			return "Indexing complete"
		case "Error":
			return "Error during indexing"
		default:
			return "Unknown status"
	}
}
