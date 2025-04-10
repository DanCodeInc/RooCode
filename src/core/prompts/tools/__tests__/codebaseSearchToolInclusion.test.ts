import * as vscode from "vscode"
import { getToolDescriptionsForMode } from "../index"
import { CodeIndexManager } from "../../../../services/code-index/manager"
import { Mode } from "../../../../shared/modes"
import * as codebaseSearchModule from "../codebase-search"

// Mock dependencies
jest.mock("vscode")
jest.mock("../../../../services/code-index/manager")
jest.mock("../codebase-search")
jest.mock("../../../../shared/modes", () => ({
	getModeBySlug: jest.fn().mockReturnValue({
		slug: "default",
		name: "Default",
		description: "Default mode",
		tools: ["codebase_search", "other_tool"],
		groups: ["read"],
	}),
	getModeConfig: jest.fn().mockReturnValue({
		slug: "default",
		name: "Default",
		description: "Default mode",
		tools: ["codebase_search", "other_tool"],
		groups: ["read"],
	}),
	getGroupName: jest.fn().mockImplementation((group) => group),
	isToolAllowedForMode: jest.fn().mockReturnValue(true),
}))
jest.mock("../../../../shared/tool-groups", () => ({
	TOOL_GROUPS: {
		read: {
			tools: ["codebase_search", "read_file"],
		},
	},
	ALWAYS_AVAILABLE_TOOLS: ["ask_followup_question", "attempt_completion", "switch_mode", "new_task"],
}))

describe("Codebase Search Tool Inclusion", () => {
	// Setup common test variables
	const mockCwd = "/test/workspace"
	const mockSupportsComputerUse = true
	const mockMode: Mode = "default"

	// Create mock manager with getters for isFeatureEnabled and isFeatureConfigured
	let mockIsEnabled = true
	let mockIsConfigured = true

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

		// Mock the getCodebaseSearchDescription function
		jest.mocked(codebaseSearchModule.getCodebaseSearchDescription).mockReturnValue(
			"## codebase_search\nDescription: Search the codebase for relevant code snippets",
		)

		jest.clearAllMocks()
	})

	it("should include codebase_search tool when indexing is enabled and configured", () => {
		// Set indexing to enabled and configured
		mockIsEnabled = true
		mockIsConfigured = true

		// Get tool descriptions
		const toolDescriptions = getToolDescriptionsForMode(mockMode, mockCwd, mockSupportsComputerUse, mockManager)

		// Verify codebase_search tool is included
		expect(toolDescriptions).toContain("codebase_search")
	})

	it("should exclude codebase_search tool when indexing is disabled", () => {
		// Set indexing to disabled
		mockIsEnabled = false
		mockIsConfigured = true

		// Get tool descriptions
		const toolDescriptions = getToolDescriptionsForMode(mockMode, mockCwd, mockSupportsComputerUse, mockManager)

		// Verify codebase_search tool is excluded
		expect(toolDescriptions).not.toContain("codebase_search")
	})

	it("should exclude codebase_search tool when indexing is not configured", () => {
		// Set indexing to enabled but not configured
		mockIsEnabled = true
		mockIsConfigured = false

		// Get tool descriptions
		const toolDescriptions = getToolDescriptionsForMode(mockMode, mockCwd, mockSupportsComputerUse, mockManager)

		// Verify codebase_search tool is excluded
		expect(toolDescriptions).not.toContain("codebase_search")
	})
})
