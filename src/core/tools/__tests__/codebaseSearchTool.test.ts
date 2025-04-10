import * as vscode from "vscode"
import { codebaseSearchTool } from "../codebaseSearchTool"
import { Cline } from "../../Cline"
import { CodeIndexManager } from "../../../services/code-index/manager"
import { QdrantSearchResult } from "../../../services/code-index/types"

// Mock dependencies
jest.mock("vscode")
jest.mock("../../Cline")
jest.mock("../../../services/code-index/manager")

describe("codebaseSearchTool", () => {
	// Setup common mocks
	const mockPushToolResult = jest.fn()
	const mockAskApproval = jest.fn().mockResolvedValue(true)
	const mockHandleError = jest.fn()
	const mockRemoveClosingTag = jest.fn()
	const mockCline = {
		providerRef: {
			deref: jest.fn().mockReturnValue({
				context: {} as vscode.ExtensionContext,
			}),
		},
		say: jest.fn().mockResolvedValue(undefined),
		consecutiveMistakeCount: 0,
	} as unknown as Cline

	const mockToolUse = {
		params: {
			query: "test query",
			limit: "5",
		},
	}

	// Create mock properties for CodeIndexManager
	let mockIsEnabled = true
	let mockIsConfigured = true
	const mockSearchIndex = jest.fn()

	// Mock manager instance
	const mockManager = {
		searchIndex: mockSearchIndex,
		get isFeatureEnabled() {
			return mockIsEnabled
		},
		get isFeatureConfigured() {
			return mockIsConfigured
		},
	}

	beforeEach(() => {
		jest.clearAllMocks()
		// Setup CodeIndexManager mock
		jest.mocked(CodeIndexManager.getInstance).mockReturnValue(mockManager as unknown as CodeIndexManager)
	})

	it("should handle error when code indexing is disabled", async () => {
		// Set indexing to disabled
		mockIsEnabled = false

		await codebaseSearchTool(
			mockCline,
			mockToolUse as any,
			mockPushToolResult,
			mockAskApproval,
			mockHandleError,
			mockRemoveClosingTag,
		)

		// Verify handleError was called with the right error
		expect(mockHandleError).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				message: expect.stringContaining("disabled"),
			}),
		)

		expect(mockSearchIndex).not.toHaveBeenCalled()
	})

	it("should handle error when code indexing is not configured", async () => {
		// Set indexing to enabled but not configured
		mockIsEnabled = true
		mockIsConfigured = false

		await codebaseSearchTool(
			mockCline,
			mockToolUse as any,
			mockPushToolResult,
			mockAskApproval,
			mockHandleError,
			mockRemoveClosingTag,
		)

		// Verify handleError was called with the right error
		expect(mockHandleError).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				message: expect.stringContaining("not configured"),
			}),
		)

		expect(mockSearchIndex).not.toHaveBeenCalled()
	})

	it("should search the codebase when indexing is enabled and configured", async () => {
		// Set indexing to enabled and configured
		mockIsEnabled = true
		mockIsConfigured = true

		// Mock search results
		const mockResults: QdrantSearchResult[] = [
			{
				id: "1",
				score: 0.95,
				payload: {
					filePath: "/path/to/file.ts",
					startLine: 10,
					endLine: 20,
					codeChunk: "function test() { return true; }",
				},
			},
		]
		mockSearchIndex.mockResolvedValue(mockResults)

		// Reset mockHandleError to not throw
		mockHandleError.mockImplementation(() => {})

		await codebaseSearchTool(
			mockCline,
			mockToolUse as any,
			mockPushToolResult,
			mockAskApproval,
			mockHandleError,
			mockRemoveClosingTag,
		)

		// Verify search was performed
		expect(mockSearchIndex).toHaveBeenCalledWith("test query", 5)
		expect(mockCline.say).toHaveBeenCalled()
		expect(mockHandleError).not.toHaveBeenCalled()
	})

	it("should handle no search results", async () => {
		// Set indexing to enabled and configured
		mockIsEnabled = true
		mockIsConfigured = true

		// Mock empty search results
		mockSearchIndex.mockResolvedValue([])

		// Reset mockHandleError to not throw
		mockHandleError.mockImplementation(() => {})

		await codebaseSearchTool(
			mockCline,
			mockToolUse as any,
			mockPushToolResult,
			mockAskApproval,
			mockHandleError,
			mockRemoveClosingTag,
		)

		// Verify handling of no results
		expect(mockSearchIndex).toHaveBeenCalledWith("test query", 5)
		expect(mockPushToolResult).toHaveBeenCalledWith(expect.stringContaining("No relevant code snippets found"))
	})
})
