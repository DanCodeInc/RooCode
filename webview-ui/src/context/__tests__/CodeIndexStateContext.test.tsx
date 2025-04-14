// cd webview-ui && npx jest src/context/__tests__/CodeIndexStateContext.test.tsx

import { render, screen, act } from "@testing-library/react"
import { ExtensionStateContextProvider, useExtensionState } from "../ExtensionStateContext"

// Mock vscode API
jest.mock("../../utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Test component that consumes the code index context fields
const CodeIndexTestComponent = () => {
	const {
		codeIndexEnabled,
		codeIndexQdrantUrl,
		codeIndexEmbedderType,
		codeIndexOllamaBaseUrl,
		codeIndexOllamaModelId,
		setCachedStateField,
	} = useExtensionState()

	return (
		<div>
			<div data-testid="code-index-enabled">{JSON.stringify(codeIndexEnabled)}</div>
			<div data-testid="code-index-qdrant-url">{JSON.stringify(codeIndexQdrantUrl)}</div>
			<div data-testid="code-index-embedder-type">{JSON.stringify(codeIndexEmbedderType)}</div>
			<div data-testid="code-index-ollama-base-url">{JSON.stringify(codeIndexOllamaBaseUrl)}</div>
			<div data-testid="code-index-ollama-model-id">{JSON.stringify(codeIndexOllamaModelId)}</div>
			<button
				data-testid="enable-code-index-button"
				onClick={() => setCachedStateField("codeIndexEnabled", true)}>
				Enable Code Index
			</button>
			<button
				data-testid="change-embedder-button"
				onClick={() => setCachedStateField("codeIndexEmbedderType", "ollama")}>
				Switch to Ollama
			</button>
		</div>
	)
}

describe("Code Index State Context", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	it("initializes with default code index values", () => {
		render(
			<ExtensionStateContextProvider>
				<CodeIndexTestComponent />
			</ExtensionStateContextProvider>,
		)

		// Check default values
		expect(screen.getByTestId("code-index-enabled").textContent).toBe("false")
		expect(screen.getByTestId("code-index-qdrant-url").textContent).toBe('""')
		expect(screen.getByTestId("code-index-embedder-type").textContent).toBe('"openai"')
		expect(screen.getByTestId("code-index-ollama-base-url").textContent).toBe('"http://localhost:11434"')
		expect(screen.getByTestId("code-index-ollama-model-id").textContent).toBe('"nomic-embed-text:latest"')
	})

	it("updates code index enabled state", () => {
		render(
			<ExtensionStateContextProvider>
				<CodeIndexTestComponent />
			</ExtensionStateContextProvider>,
		)

		// Initial state should be false
		expect(screen.getByTestId("code-index-enabled").textContent).toBe("false")

		// Update state
		act(() => {
			screen.getByTestId("enable-code-index-button").click()
		})

		// State should be updated
		expect(screen.getByTestId("code-index-enabled").textContent).toBe("true")
	})

	it("updates embedder type", () => {
		render(
			<ExtensionStateContextProvider>
				<CodeIndexTestComponent />
			</ExtensionStateContextProvider>,
		)

		// Initial state should be "openai"
		expect(screen.getByTestId("code-index-embedder-type").textContent).toBe('"openai"')

		// Update state
		act(() => {
			screen.getByTestId("change-embedder-button").click()
		})

		// State should be updated
		expect(screen.getByTestId("code-index-embedder-type").textContent).toBe('"ollama"')
	})

	it("preserves other state when updating code index fields", () => {
		const TestComponent = () => {
			const { codeIndexEnabled, codeIndexEmbedderType, allowedCommands, setCachedStateField } =
				useExtensionState()

			return (
				<div>
					<div data-testid="code-index-enabled">{JSON.stringify(codeIndexEnabled)}</div>
					<div data-testid="code-index-embedder-type">{JSON.stringify(codeIndexEmbedderType)}</div>
					<div data-testid="allowed-commands">{JSON.stringify(allowedCommands)}</div>
					<button
						data-testid="update-button"
						onClick={() => {
							setCachedStateField("codeIndexEnabled", true)
							setCachedStateField("codeIndexEmbedderType", "ollama")
						}}>
						Update
					</button>
				</div>
			)
		}

		render(
			<ExtensionStateContextProvider>
				<TestComponent />
			</ExtensionStateContextProvider>,
		)

		// Initial state
		expect(screen.getByTestId("code-index-enabled").textContent).toBe("false")
		expect(screen.getByTestId("code-index-embedder-type").textContent).toBe('"openai"')
		expect(screen.getByTestId("allowed-commands").textContent).toBe("[]")

		// Update state
		act(() => {
			screen.getByTestId("update-button").click()
		})

		// Code index state should be updated
		expect(screen.getByTestId("code-index-enabled").textContent).toBe("true")
		expect(screen.getByTestId("code-index-embedder-type").textContent).toBe('"ollama"')

		// Other state should be preserved
		expect(screen.getByTestId("allowed-commands").textContent).toBe("[]")
	})
})
