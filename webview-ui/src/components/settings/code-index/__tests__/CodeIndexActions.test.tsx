import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { CodeIndexActions } from "../components/CodeIndexActions"

// Mock VSCodeButton component
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeButton: ({ children, onClick, disabled, appearance }: any) => (
		<button data-testid={`vscode-button-${appearance || "primary"}`} onClick={onClick} disabled={disabled}>
			{children}
		</button>
	),
}))

// Mock AlertDialog components
jest.mock("@/components/ui/alert-dialog", () => ({
	AlertDialog: ({ children }: any) => <div data-testid="alert-dialog">{children}</div>,
	AlertDialogTrigger: ({ asChild, children }: any) => <div data-testid="alert-dialog-trigger">{children}</div>,
	AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
	AlertDialogHeader: ({ children }: any) => <div data-testid="alert-dialog-header">{children}</div>,
	AlertDialogTitle: ({ children }: any) => <div data-testid="alert-dialog-title">{children}</div>,
	AlertDialogDescription: ({ children }: any) => <div data-testid="alert-dialog-description">{children}</div>,
	AlertDialogFooter: ({ children }: any) => <div data-testid="alert-dialog-footer">{children}</div>,
	AlertDialogCancel: ({ children }: any) => <button data-testid="alert-dialog-cancel">{children}</button>,
	AlertDialogAction: ({ onClick, children }: any) => (
		<button data-testid="alert-dialog-action" onClick={onClick}>
			{children}
		</button>
	),
}))

describe("CodeIndexActions", () => {
	const defaultProps = {
		onStartIndexing: jest.fn(),
		onClearIndexData: jest.fn(),
		isStartDisabled: false,
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("renders start indexing button and clear data button", () => {
		render(<CodeIndexActions {...defaultProps} />)

		expect(screen.getByTestId("vscode-button-primary")).toBeInTheDocument()
		expect(screen.getByTestId("vscode-button-primary")).toHaveTextContent("Start Indexing")

		expect(screen.getByTestId("alert-dialog-trigger")).toBeInTheDocument()
		expect(screen.getByTestId("vscode-button-secondary")).toHaveTextContent("Clear Index Data")
	})

	it("disables start button when isStartDisabled is true", () => {
		render(<CodeIndexActions {...defaultProps} isStartDisabled={true} />)

		expect(screen.getByTestId("vscode-button-primary")).toBeDisabled()
	})

	it("calls onStartIndexing when start button is clicked", () => {
		render(<CodeIndexActions {...defaultProps} />)

		fireEvent.click(screen.getByTestId("vscode-button-primary"))

		expect(defaultProps.onStartIndexing).toHaveBeenCalled()
	})

	it("calls onClearIndexData when clear action is clicked", () => {
		render(<CodeIndexActions {...defaultProps} />)

		// Find and click the clear action button in the dialog
		fireEvent.click(screen.getByTestId("alert-dialog-action"))

		expect(defaultProps.onClearIndexData).toHaveBeenCalled()
	})
})
