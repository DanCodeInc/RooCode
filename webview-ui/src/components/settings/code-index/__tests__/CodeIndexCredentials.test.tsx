import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { CodeIndexCredentials } from "../components/CodeIndexCredentials"

// Mock VSCodeTextField component
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, value, onInput, type }: any) => (
		<div>
			<label>
				<input
					data-testid={`vscode-textfield-${type || "text"}`}
					value={value}
					onChange={(e) => onInput({ target: { value: e.target.value } })}
					type={type || "text"}
				/>
				{children}
			</label>
		</div>
	),
}))

describe("CodeIndexCredentials", () => {
	const defaultProps = {
		openAiKey: "",
		qdrantUrl: "",
		onOpenAiKeyChange: jest.fn(),
		onQdrantUrlChange: jest.fn(),
	}

	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("renders OpenAI key input with correct type and value", () => {
		render(<CodeIndexCredentials {...defaultProps} openAiKey="test-key" />)

		const keyInput = screen.getByTestId("vscode-textfield-password")
		expect(keyInput).toBeInTheDocument()
		expect(keyInput).toHaveValue("test-key")
	})

	it("renders Qdrant URL input with correct value", () => {
		render(<CodeIndexCredentials {...defaultProps} qdrantUrl="http://test-url" />)

		const urlInput = screen.getByTestId("vscode-textfield-text")
		expect(urlInput).toBeInTheDocument()
		expect(urlInput).toHaveValue("http://test-url")
	})

	it("calls onOpenAiKeyChange when key input changes", () => {
		render(<CodeIndexCredentials {...defaultProps} />)

		const keyInput = screen.getByTestId("vscode-textfield-password")
		fireEvent.change(keyInput, { target: { value: "new-key" } })

		expect(defaultProps.onOpenAiKeyChange).toHaveBeenCalledWith("new-key")
	})

	it("calls onQdrantUrlChange when URL input changes", () => {
		render(<CodeIndexCredentials {...defaultProps} />)

		const urlInput = screen.getByTestId("vscode-textfield-text")
		fireEvent.change(urlInput, { target: { value: "http://new-url" } })

		expect(defaultProps.onQdrantUrlChange).toHaveBeenCalledWith("http://new-url")
	})
})
