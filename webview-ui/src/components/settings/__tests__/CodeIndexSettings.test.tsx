import React from "react"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { CodeIndexSettings } from "../CodeIndexSettings"
import { vscode } from "../../../utils/vscode"

// Mock vscode API
jest.mock("../../../utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Mock VSCode UI components
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({
		children,
		checked,
		onChange,
	}: {
		children: React.ReactNode
		checked?: boolean
		onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
	}) => (
		<label>
			<input type="checkbox" checked={checked} onChange={onChange} data-testid="vscode-checkbox" />
			<span>{children}</span>
		</label>
	),
	VSCodeTextField: ({
		children,
		value,
		onInput,
		type = "text",
	}: {
		children: React.ReactNode
		value?: string
		onInput?: (e: React.ChangeEvent<HTMLInputElement>) => void
		type?: string
	}) => (
		<div style={{ position: "relative", display: "inline-block", width: "100%" }}>
			<input
				type={type}
				value={value || ""}
				onChange={onInput}
				data-testid={`vscode-textfield-${children?.toString().toLowerCase().replace(/\s+/g, "-")}`}
			/>
			{children}
		</div>
	),
	VSCodeButton: ({
		children,
		onClick,
		disabled,
		appearance,
	}: {
		children: React.ReactNode
		onClick?: () => void
		disabled?: boolean
		appearance?: string
	}) => (
		<button
			onClick={onClick}
			disabled={disabled}
			data-testid={`vscode-button-${children?.toString().toLowerCase().replace(/\s+/g, "-")}`}
			data-appearance={appearance}>
			{children}
		</button>
	),
	VSCodeDropdown: ({
		children,
		value,
		onChange,
	}: {
		children: React.ReactNode
		value?: string
		onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
	}) => (
		<select value={value} onChange={onChange} data-testid="vscode-dropdown">
			{children}
		</select>
	),
	VSCodeOption: ({ children, value }: { children: React.ReactNode; value?: string }) => (
		<option value={value}>{children}</option>
	),
}))

// Mock alert dialog
jest.mock("@/components/ui/alert-dialog", () => ({
	AlertDialog: ({ children }: { children: React.ReactNode }) => <div data-testid="alert-dialog">{children}</div>,
	AlertDialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
		<div data-testid="alert-dialog-trigger">{children}</div>
	),
	AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="alert-dialog-content">{children}</div>
	),
	AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="alert-dialog-header">{children}</div>
	),
	AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="alert-dialog-footer">{children}</div>
	),
	AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="alert-dialog-title">{children}</div>
	),
	AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="alert-dialog-description">{children}</div>
	),
	AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
		<button data-testid="alert-dialog-action" onClick={onClick}>
			{children}
		</button>
	),
	AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
		<button data-testid="alert-dialog-cancel">{children}</button>
	),
}))

describe("CodeIndexSettings", () => {
	const defaultProps = {
		codeIndexEnabled: false,
		codeIndexQdrantUrl: "",
		codeIndexEmbedderType: "openai",
		codeIndexOllamaBaseUrl: "http://localhost:11434",
		codeIndexOllamaModelId: "nomic-embed-text:latest",
		apiConfiguration: {
			openAiNativeApiKey: "test-key",
		},
		setCachedStateField: jest.fn(),
		setApiConfigurationField: jest.fn(),
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("should render with default props", () => {
		render(<CodeIndexSettings {...defaultProps} />)

		// Check that the component renders with the header
		expect(screen.getAllByText(/Codebase Indexing/)[0]).toBeInTheDocument()

		// Check that the enable checkbox is unchecked by default
		const enableCheckbox = screen.getByTestId("vscode-checkbox")
		expect(enableCheckbox).not.toBeChecked()
	})

	it("should toggle code indexing when checkbox is clicked", () => {
		render(<CodeIndexSettings {...defaultProps} />)

		const enableCheckbox = screen.getByTestId("vscode-checkbox")
		fireEvent.click(enableCheckbox)

		// Verify callback was called
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("codeIndexEnabled", true)
	})

	it("should update Qdrant URL when input changes", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} />)

		const qdrantUrlInput = screen.getByTestId("vscode-textfield-qdrant-url")
		fireEvent.change(qdrantUrlInput, { target: { value: "http://test-qdrant:6333" } })

		// Verify callback was called
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("codeIndexQdrantUrl", "http://test-qdrant:6333")
	})

	it("should show OpenAI settings when OpenAI embedder is selected", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} codeIndexEmbedderType="openai" />)

		// Check that OpenAI API key field is visible
		expect(screen.getByText(/OpenAI API Key/)).toBeInTheDocument()

		// Check that Ollama settings are not visible
		expect(screen.queryByText(/Ollama Base URL/)).not.toBeInTheDocument()
	})

	it("should show Ollama settings when Ollama embedder is selected", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} codeIndexEmbedderType="ollama" />)

		// Check that Ollama settings are visible
		expect(screen.getByText(/Ollama Base URL/)).toBeInTheDocument()
		expect(screen.getByText(/Ollama Model ID/)).toBeInTheDocument()

		// OpenAI settings should not be visible
		expect(screen.queryByText(/OpenAI API Key/)).not.toBeInTheDocument()
	})

	it("should change embedder type when selection changes", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} />)

		// Find the embedder type select
		const embedderTypeSelect = screen.getByTestId("vscode-dropdown")

		// Change to Ollama
		fireEvent.change(embedderTypeSelect, { target: { value: "ollama" } })

		// Verify callback was called
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("codeIndexEmbedderType", "ollama")
	})

	it("should update Ollama Base URL when input changes", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} codeIndexEmbedderType="ollama" />)

		const ollamaBaseUrlInput = screen.getByTestId("vscode-textfield-ollama-base-url")
		fireEvent.change(ollamaBaseUrlInput, { target: { value: "http://custom-ollama:11434" } })

		// Verify callback was called
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith(
			"codeIndexOllamaBaseUrl",
			"http://custom-ollama:11434",
		)
	})

	it("should update Ollama Model ID when input changes", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} codeIndexEmbedderType="ollama" />)

		const ollamaModelIdInput = screen.getByTestId("vscode-textfield-ollama-model-id")
		fireEvent.change(ollamaModelIdInput, { target: { value: "custom-model" } })

		// Verify callback was called
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("codeIndexOllamaModelId", "custom-model")
	})

	it("should request indexing status on mount", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} />)

		// Verify status request was sent
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "requestIndexingStatus",
		})
	})

	it("should handle clear index button click", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} />)

		// Find the clear index button in the alert dialog trigger
		const alertDialogTrigger = screen.getByTestId("alert-dialog-trigger")
		const clearButton = within(alertDialogTrigger).getByText(/Clear Index Data/)
		fireEvent.click(clearButton)

		// Find and click the confirm button in the alert dialog
		const alertDialogAction = screen.getByTestId("alert-dialog-action")
		fireEvent.click(alertDialogAction)

		// Verify clear request was sent
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "clearIndexData",
		})
	})
})
