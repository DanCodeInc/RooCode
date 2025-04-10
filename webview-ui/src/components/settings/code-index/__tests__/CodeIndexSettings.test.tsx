import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { CodeIndexSettings } from "../CodeIndexSettings"

// Mock the custom hooks
jest.mock("../hooks/useCodeIndexStatus", () => ({
	useCodeIndexStatus: jest.fn(() => ({
		systemStatus: "Standby",
		indexingMessage: "",
		processedFiles: 0,
		skippedFiles: 0,
		progressPercent: 0,
		updateStatus: jest.fn(),
	})),
}))

jest.mock("../hooks/useCodeIndexMessaging", () => ({
	useCodeIndexMessaging: jest.fn(() => ({
		startIndexing: jest.fn(),
		clearIndexData: jest.fn(),
	})),
}))

// Mock the child components
jest.mock("../components/CodeIndexToggle", () => ({
	CodeIndexToggle: ({ enabled, onChange }: any) => (
		<div data-testid="code-index-toggle">
			<input
				type="checkbox"
				data-testid="toggle-checkbox"
				checked={enabled}
				onChange={(e) => onChange(e.target.checked)}
			/>
		</div>
	),
}))

jest.mock("../components/CodeIndexCredentials", () => ({
	CodeIndexCredentials: ({ openAiKey, qdrantUrl, onOpenAiKeyChange, onQdrantUrlChange }: any) => (
		<div data-testid="code-index-credentials">
			<input
				data-testid="openai-key-input"
				value={openAiKey}
				onChange={(e) => onOpenAiKeyChange(e.target.value)}
			/>
			<input
				data-testid="qdrant-url-input"
				value={qdrantUrl}
				onChange={(e) => onQdrantUrlChange(e.target.value)}
			/>
		</div>
	),
}))

jest.mock("../components/CodeIndexStatus", () => ({
	CodeIndexStatus: ({ systemStatus, message, processedFiles, skippedFiles, progressPercent }: any) => (
		<div data-testid="code-index-status">
			<span data-testid="status">{systemStatus}</span>
			<span data-testid="message">{message}</span>
			<span data-testid="processed-files">{processedFiles}</span>
			<span data-testid="skipped-files">{skippedFiles}</span>
			<span data-testid="progress-percent">{progressPercent}</span>
		</div>
	),
}))

jest.mock("../components/CodeIndexActions", () => ({
	CodeIndexActions: ({ onStartIndexing, onClearIndexData, isStartDisabled }: any) => (
		<div data-testid="code-index-actions">
			<button data-testid="start-indexing-button" disabled={isStartDisabled} onClick={onStartIndexing}>
				Start Indexing
			</button>
			<button data-testid="clear-index-button" onClick={onClearIndexData}>
				Clear Index Data
			</button>
		</div>
	),
}))

// Mock the Section and SectionHeader components
jest.mock("../../Section", () => ({
	Section: ({ children }: any) => <div data-testid="section">{children}</div>,
}))

jest.mock("../../SectionHeader", () => ({
	SectionHeader: ({ children }: any) => <div data-testid="section-header">{children}</div>,
}))

describe("CodeIndexSettings", () => {
	const defaultProps = {
		codeIndexEnabled: false,
		codeIndexOpenAiKey: "",
		codeIndexQdrantUrl: "",
		setCachedStateField: jest.fn(),
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("renders correctly with indexing disabled", () => {
		render(<CodeIndexSettings {...defaultProps} />)

		// Header and toggle should be visible
		expect(screen.getByTestId("section-header")).toBeInTheDocument()
		expect(screen.getByTestId("code-index-toggle")).toBeInTheDocument()

		// Credentials, status, and actions should not be visible
		expect(screen.queryByTestId("code-index-credentials")).not.toBeInTheDocument()
		expect(screen.queryByTestId("code-index-status")).not.toBeInTheDocument()
		expect(screen.queryByTestId("code-index-actions")).not.toBeInTheDocument()
	})

	it("renders all components when indexing is enabled", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} />)

		// All components should be visible
		expect(screen.getByTestId("section-header")).toBeInTheDocument()
		expect(screen.getByTestId("code-index-toggle")).toBeInTheDocument()
		expect(screen.getByTestId("code-index-credentials")).toBeInTheDocument()
		expect(screen.getByTestId("code-index-status")).toBeInTheDocument()
		expect(screen.getByTestId("code-index-actions")).toBeInTheDocument()
	})

	it("calls setCachedStateField when toggle is clicked", () => {
		render(<CodeIndexSettings {...defaultProps} />)

		// Click the toggle
		fireEvent.click(screen.getByTestId("toggle-checkbox"))

		// Check if setCachedStateField was called with the correct arguments
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("codeIndexEnabled", true)
	})

	it("calls setCachedStateField when OpenAI key is changed", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} />)

		// Change the OpenAI key
		fireEvent.change(screen.getByTestId("openai-key-input"), { target: { value: "test-key" } })

		// Check if setCachedStateField was called with the correct arguments
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("codeIndexOpenAiKey", "test-key")
	})

	it("calls setCachedStateField when Qdrant URL is changed", () => {
		render(<CodeIndexSettings {...defaultProps} codeIndexEnabled={true} />)

		// Change the Qdrant URL
		fireEvent.change(screen.getByTestId("qdrant-url-input"), { target: { value: "http://test-url" } })

		// Check if setCachedStateField was called with the correct arguments
		expect(defaultProps.setCachedStateField).toHaveBeenCalledWith("codeIndexQdrantUrl", "http://test-url")
	})
})
