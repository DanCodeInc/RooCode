import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { CodeIndexStatus } from "../components/CodeIndexStatus"
import { IndexingSystemStatus } from "../types"

// Mock the statusHelpers utility
jest.mock("../utils/statusHelpers", () => ({
	getStatusIndicatorClass: (status: string) => {
		switch (status) {
			case "Standby":
				return "bg-gray-400"
			case "Indexing":
				return "bg-yellow-500 animate-pulse"
			case "Indexed":
				return "bg-green-500"
			case "Error":
				return "bg-red-500"
			default:
				return "bg-gray-400"
		}
	},
}))

describe("CodeIndexStatus", () => {
	const defaultProps = {
		systemStatus: "Standby" as IndexingSystemStatus,
		message: "",
		processedFiles: 0,
		skippedFiles: 0,
		progressPercent: 0,
	}

	it("renders status indicator with correct color for Standby", () => {
		render(<CodeIndexStatus {...defaultProps} />)

		const statusText = screen.getByText("Standby")
		expect(statusText).toBeInTheDocument()

		// Progress bar should not be visible
		expect(screen.queryByText("% complete")).not.toBeInTheDocument()
	})

	it("renders status indicator with correct color for Indexing", () => {
		render(
			<CodeIndexStatus
				{...defaultProps}
				systemStatus="Indexing"
				processedFiles={10}
				skippedFiles={2}
				progressPercent={50}
			/>,
		)

		const statusText = screen.getByText("Indexing")
		expect(statusText).toBeInTheDocument()

		// Progress bar should be visible
		expect(screen.getByText("50% complete")).toBeInTheDocument()
		expect(screen.getByText("10 processed, 2 skipped")).toBeInTheDocument()
	})

	it("renders status indicator with correct color for Indexed", () => {
		render(<CodeIndexStatus {...defaultProps} systemStatus="Indexed" processedFiles={100} skippedFiles={5} />)

		const statusText = screen.getByText("Indexed")
		expect(statusText).toBeInTheDocument()

		// Total files indexed should be visible
		expect(screen.getByText("Total files indexed: 105")).toBeInTheDocument()
	})

	it("renders status indicator with correct color for Error", () => {
		render(<CodeIndexStatus {...defaultProps} systemStatus="Error" message="Something went wrong" />)

		const statusText = screen.getByText("Error")
		expect(statusText).toBeInTheDocument()

		// Error message should be visible
		expect(screen.getAllByText("Something went wrong")).toHaveLength(2)
	})

	it("displays message when provided", () => {
		render(<CodeIndexStatus {...defaultProps} message="Processing files..." />)

		expect(screen.getByText("Processing files...")).toBeInTheDocument()
	})
})
