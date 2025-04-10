import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
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
import { CodeIndexActionsProps } from "../types"

/**
 * Component for code indexing action buttons
 */
export const CodeIndexActions: React.FC<CodeIndexActionsProps> = ({
	onStartIndexing,
	onClearIndexData,
	isStartDisabled,
}) => {
	return (
		<div className="flex gap-2">
			<VSCodeButton onClick={onStartIndexing} disabled={isStartDisabled}>
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
							This action cannot be undone. This will permanently delete your codebase index data.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={onClearIndexData}>Clear Data</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
