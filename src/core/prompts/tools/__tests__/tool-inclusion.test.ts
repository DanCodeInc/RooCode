import * as vscode from "vscode"
import { getToolDescriptionsForMode } from "../index"
import { CodeIndexManager } from "../../../../services/code-index/manager"
import { Mode } from "../../../../shared/modes"

// Mock dependencies
jest.mock("vscode")
jest.mock("../../../../services/code-index/manager")

describe("Tool Inclusion Logic", () => {
	// Setup common test variables
	const mockCwd = "/test/workspace"
	const mockSupportsComputerUse = true
	const mockMode: Mode = "default"

	// Create mock properties for CodeIndexManager
	let mockIsEnabled = true
	let mockIsConfigured = true

	// Create mock context
	const mockContext = {
		globalState: {
			get: jest.fn(),
			update: jest.fn(),
		},
	} as unknown as vscode.ExtensionContext

	// Create mock manager
	const mockManager = {
		get isFeatureEnabled() {
			return mockIsEnabled
		},
		get isFeatureConfigured() {
			return mockIsConfigured
		},
	} as unknown as CodeIndexManager

	beforeEach(() => {
		// Reset mock properties
		mockIsEnabled = true
		mockIsConfigured = true

		// Mock the getInstance method
		jest.mocked(CodeIndexManager.getInstance).mockReturnValue(mockManager)

		jest.clearAllMocks()
	})

	it("should include codebase_search tool when indexing is enabled and configured", () => {
		// Set indexing to enabled and configured
		mockIsEnabled = true
		mockIsConfigured = true

		const toolDescriptions = getToolDescriptionsForMode(mockMode, mockCwd, mockSupportsComputerUse, mockManager)

		// Verify codebase_search tool is included
		expect(toolDescriptions).toContain("codebase_search")
	})

	it("should exclude codebase_search tool when indexing is disabled", () => {
		// Set indexing to disabled
		mockIsEnabled = false
		mockIsConfigured = true

		const toolDescriptions = getToolDescriptionsForMode(mockMode, mockCwd, mockSupportsComputerUse, mockManager)

		// Verify codebase_search tool is excluded
		expect(toolDescriptions).not.toContain("codebase_search")
	})

	it("should exclude codebase_search tool when indexing is not configured", () => {
		// Set indexing to enabled but not configured
		mockIsEnabled = true
		mockIsConfigured = false

		const toolDescriptions = getToolDescriptionsForMode(mockMode, mockCwd, mockSupportsComputerUse, mockManager)

		// Verify codebase_search tool is excluded
		expect(toolDescriptions).not.toContain("codebase_search")
	})
})
