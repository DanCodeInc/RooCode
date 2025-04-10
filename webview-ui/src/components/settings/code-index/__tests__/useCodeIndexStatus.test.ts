import { renderHook, act } from "@testing-library/react"
import { useCodeIndexStatus } from "../hooks/useCodeIndexStatus"

// Mock the statusHelpers utility
jest.mock("../utils/statusHelpers", () => ({
	calculateProgressPercentage: (processed: number, total: number) => {
		if (total <= 0) return 0
		return Math.min(Math.round((processed / total) * 100), 100)
	},
}))

describe("useCodeIndexStatus", () => {
	it("initializes with default values", () => {
		const { result } = renderHook(() => useCodeIndexStatus(false))

		expect(result.current.systemStatus).toBe("Standby")
		expect(result.current.indexingMessage).toBe("")
		expect(result.current.processedFiles).toBe(0)
		expect(result.current.skippedFiles).toBe(0)
		expect(result.current.progressPercent).toBe(0)
	})

	it("resets values when enabled changes to false", () => {
		const { result, rerender } = renderHook((enabled) => useCodeIndexStatus(enabled), { initialProps: true })

		// Update status first
		act(() => {
			result.current.updateStatus("Indexing", "Processing files...", 10, 2, 20, 50)
		})

		// Verify status was updated
		expect(result.current.systemStatus).toBe("Indexing")
		expect(result.current.indexingMessage).toBe("Processing files...")
		expect(result.current.processedFiles).toBe(10)
		expect(result.current.skippedFiles).toBe(2)
		expect(result.current.progressPercent).toBe(50)

		// Now disable and check if values are reset
		rerender(false)

		expect(result.current.systemStatus).toBe("Standby")
		expect(result.current.indexingMessage).toBe("")
		expect(result.current.processedFiles).toBe(0)
		expect(result.current.skippedFiles).toBe(0)
		expect(result.current.progressPercent).toBe(0)
	})

	it("updates status values correctly", () => {
		const { result } = renderHook(() => useCodeIndexStatus(true))

		act(() => {
			result.current.updateStatus("Indexing", "Processing files...", 10, 2, 20, 50)
		})

		expect(result.current.systemStatus).toBe("Indexing")
		expect(result.current.indexingMessage).toBe("Processing files...")
		expect(result.current.processedFiles).toBe(10)
		expect(result.current.skippedFiles).toBe(2)
		expect(result.current.progressPercent).toBe(50)
	})

	it("calculates progress percentage when not provided", () => {
		const { result } = renderHook(() => useCodeIndexStatus(true))

		act(() => {
			// Pass 0 for progressPercent to trigger calculation
			result.current.updateStatus("Indexing", "Processing files...", 10, 2, 20, 0)
		})

		// Should calculate 10/20 = 50%
		expect(result.current.progressPercent).toBe(50)
	})

	it("handles zero total files gracefully", () => {
		const { result } = renderHook(() => useCodeIndexStatus(true))

		act(() => {
			// Pass 0 for total files
			result.current.updateStatus("Indexing", "Processing files...", 10, 2, 0, 0)
		})

		// Should not calculate percentage when total is 0
		expect(result.current.progressPercent).toBe(0)
	})
})
