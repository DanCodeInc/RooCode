import React from "react"
import { CodeIndexStatusProps } from "../types"
import { getStatusIndicatorClass } from "../utils/statusHelpers"

/**
 * Component for displaying code indexing status
 */
export const CodeIndexStatus: React.FC<CodeIndexStatusProps> = ({
	systemStatus,
	message,
	processedFiles,
	skippedFiles,
	progressPercent,
}) => {
	return (
		<div className="space-y-2">
			{/* Status indicator */}
			<div className="text-sm text-vscode-descriptionForeground flex items-center">
				<span
					className={`inline-block w-3 h-3 rounded-full mr-2 ${getStatusIndicatorClass(systemStatus)}`}></span>
				<span className="font-medium">{systemStatus}</span>
				{message ? <span className="ml-2">{message}</span> : ""}
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
			{systemStatus === "Error" && message && (
				<div className="text-xs text-red-500 bg-red-500 bg-opacity-10 p-2 rounded border border-red-500 border-opacity-20">
					{message}
				</div>
			)}

			{/* Success details - only show when indexed */}
			{systemStatus === "Indexed" && (
				<div className="text-xs text-vscode-descriptionForeground">
					Total files indexed: {processedFiles + skippedFiles}
				</div>
			)}
		</div>
	)
}
