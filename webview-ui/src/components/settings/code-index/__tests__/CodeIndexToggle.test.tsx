import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { CodeIndexToggle } from "../components/CodeIndexToggle"

// Mock VSCodeCheckbox component
jest.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeCheckbox: ({ children, checked, onChange }: any) => (
		<div>
			<label>
				<input type="checkbox" data-testid="vscode-checkbox" checked={checked} onChange={(e) => onChange(e)} />
				{children}
			</label>
		</div>
	),
}))

describe("CodeIndexToggle", () => {
	it("renders correctly with enabled=false", () => {
		const onChange = jest.fn()
		render(<CodeIndexToggle enabled={false} onChange={onChange} />)

		const checkbox = screen.getByTestId("vscode-checkbox")
		expect(checkbox).toBeInTheDocument()
		expect(checkbox).not.toBeChecked()
	})

	it("renders correctly with enabled=true", () => {
		const onChange = jest.fn()
		render(<CodeIndexToggle enabled={true} onChange={onChange} />)

		const checkbox = screen.getByTestId("vscode-checkbox")
		expect(checkbox).toBeInTheDocument()
		expect(checkbox).toBeChecked()
	})

	it("calls onChange when checkbox is clicked", () => {
		const onChange = jest.fn()
		render(<CodeIndexToggle enabled={false} onChange={onChange} />)

		const checkbox = screen.getByTestId("vscode-checkbox")
		fireEvent.click(checkbox)

		// The mock VSCodeCheckbox passes the event object to onChange
		expect(onChange).toHaveBeenCalled()
	})
})
