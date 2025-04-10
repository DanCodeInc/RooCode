import { getStatusIndicatorClass, calculateProgressPercentage, getStatusDescription } from "../utils/statusHelpers"
import { IndexingSystemStatus } from "../types"

describe("statusHelpers", () => {
	describe("getStatusIndicatorClass", () => {
		it("returns correct class for Standby status", () => {
			expect(getStatusIndicatorClass("Standby")).toBe("bg-gray-400")
		})

		it("returns correct class for Indexing status", () => {
			expect(getStatusIndicatorClass("Indexing")).toBe("bg-yellow-500 animate-pulse")
		})

		it("returns correct class for Indexed status", () => {
			expect(getStatusIndicatorClass("Indexed")).toBe("bg-green-500")
		})

		it("returns correct class for Error status", () => {
			expect(getStatusIndicatorClass("Error")).toBe("bg-red-500")
		})

		it("returns default class for unknown status", () => {
			expect(getStatusIndicatorClass("Unknown" as IndexingSystemStatus)).toBe("bg-gray-400")
		})
	})

	describe("calculateProgressPercentage", () => {
		it("calculates percentage correctly", () => {
			expect(calculateProgressPercentage(50, 100)).toBe(50)
			expect(calculateProgressPercentage(25, 100)).toBe(25)
			expect(calculateProgressPercentage(75, 100)).toBe(75)
		})

		it("rounds to nearest integer", () => {
			expect(calculateProgressPercentage(33, 100)).toBe(33)
			expect(calculateProgressPercentage(66, 100)).toBe(66)
		})

		it("caps at 100%", () => {
			expect(calculateProgressPercentage(110, 100)).toBe(100)
			expect(calculateProgressPercentage(200, 100)).toBe(100)
		})

		it("handles zero total gracefully", () => {
			expect(calculateProgressPercentage(10, 0)).toBe(0)
		})

		it("handles negative values gracefully", () => {
			expect(calculateProgressPercentage(-10, 100)).toBe(0) // Should be capped at 0
			expect(calculateProgressPercentage(10, -100)).toBe(0) // Should handle negative total
		})
	})

	describe("getStatusDescription", () => {
		it("returns correct description for Standby status", () => {
			expect(getStatusDescription("Standby")).toBe("Ready to index")
		})

		it("returns correct description for Indexing status", () => {
			expect(getStatusDescription("Indexing")).toBe("Indexing in progress")
		})

		it("returns correct description for Indexed status", () => {
			expect(getStatusDescription("Indexed")).toBe("Indexing complete")
		})

		it("returns correct description for Error status", () => {
			expect(getStatusDescription("Error")).toBe("Error during indexing")
		})

		it("returns unknown description for unknown status", () => {
			expect(getStatusDescription("Unknown" as IndexingSystemStatus)).toBe("Unknown status")
		})
	})
})
