import { renderHook } from "@testing-library/react"
import { useCodeIndexMessaging } from "../hooks/useCodeIndexMessaging"
import { vscode } from "../../../../utils/vscode"

// Mock vscode API
jest.mock("../../../../utils/vscode", () => ({
	vscode: {
		postMessage: jest.fn(),
	},
}))

// Mock window event listeners
const addEventListenerMock = jest.spyOn(window, "addEventListener")
const removeEventListenerMock = jest.spyOn(window, "removeEventListener")

// Mock setInterval and clearInterval
jest.useFakeTimers()

// Mock the interval functions
const mockSetInterval = jest.fn().mockReturnValue(123)
const mockClearInterval = jest.fn()

// Store original implementations
const originalSetInterval = window.setInterval
const originalClearInterval = window.clearInterval

// Replace with mocks
window.setInterval = mockSetInterval as any
window.clearInterval = mockClearInterval as any

describe("useCodeIndexMessaging", () => {
	const mockOnStatusUpdate = jest.fn()

	beforeEach(() => {
		jest.clearAllMocks()
	})

	afterAll(() => {
		window.setInterval = originalSetInterval
		window.clearInterval = originalClearInterval
	})

	it("does not set up listeners when disabled", () => {
		renderHook(() => useCodeIndexMessaging(false, mockOnStatusUpdate))

		expect(vscode.postMessage).not.toHaveBeenCalled()
		expect(addEventListenerMock).not.toHaveBeenCalled()
		expect(mockSetInterval).not.toHaveBeenCalled()
	})

	it("sets up listeners and requests initial status when enabled", () => {
		renderHook(() => useCodeIndexMessaging(true, mockOnStatusUpdate))

		// Should request initial status
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestIndexingStatus" })

		// Should set up message listener
		expect(addEventListenerMock).toHaveBeenCalledWith("message", expect.any(Function))

		// Should set up polling interval
		expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 5000)
	})

	it("cleans up listeners and interval on unmount", () => {
		const { unmount } = renderHook(() => useCodeIndexMessaging(true, mockOnStatusUpdate))

		// Unmount the hook
		unmount()

		// Should clear the interval
		expect(mockClearInterval).toHaveBeenCalled()

		// Should remove the message listener
		expect(removeEventListenerMock).toHaveBeenCalledWith("message", expect.any(Function))
	})

	it("handles status update messages correctly", () => {
		renderHook(() => useCodeIndexMessaging(true, mockOnStatusUpdate))

		// Get the message handler function
		const messageHandler = addEventListenerMock.mock.calls[0][1] as EventListener

		// Create a mock message event
		const mockEvent = {
			data: {
				type: "indexingStatusUpdate",
				values: {
					systemStatus: "Indexing",
					message: "Processing files...",
					processedFiles: 10,
					skippedFiles: 2,
					totalFiles: 20,
					progressPercent: 50,
				},
			},
		} as any

		// Trigger the message handler
		messageHandler(mockEvent)

		// Check if onStatusUpdate was called with the correct values
		expect(mockOnStatusUpdate).toHaveBeenCalledWith("Indexing", "Processing files...", 10, 2, 20, 50)
	})

	it("sends startIndexing message correctly", () => {
		const { result } = renderHook(() => useCodeIndexMessaging(true, mockOnStatusUpdate))

		// Call startIndexing
		result.current.startIndexing()

		// Check if the correct message was sent
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "startIndexing" })
	})

	it("sends clearIndexData message correctly", () => {
		const { result } = renderHook(() => useCodeIndexMessaging(true, mockOnStatusUpdate))

		// Call clearIndexData
		result.current.clearIndexData()

		// Check if the correct message was sent
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "clearIndexData" })
	})

	it("polls for status updates at regular intervals", () => {
		renderHook(() => useCodeIndexMessaging(true, mockOnStatusUpdate))

		// Get the interval callback
		const intervalCallback = mockSetInterval.mock.calls[0][0]

		// Clear the initial call
		jest.clearAllMocks()

		// Manually invoke the interval callback
		intervalCallback()

		// Check if requestIndexingStatus was called
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestIndexingStatus" })

		// Clear mocks and invoke again
		jest.clearAllMocks()
		intervalCallback()

		// Check if requestIndexingStatus was called again
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "requestIndexingStatus" })
	})
})
