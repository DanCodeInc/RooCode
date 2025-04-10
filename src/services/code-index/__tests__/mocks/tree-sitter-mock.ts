import { jest } from "@jest/globals"

// Mock the Parser class
export class MockParser {
	static Language = {
		load: jest.fn<() => Promise<any>>().mockResolvedValue({}),
	}

	parse(content: string) {
		return {
			rootNode: {
				startPosition: { row: 0, column: 0 },
				endPosition: { row: 10, column: 0 },
				children: [
					{
						type: "function",
						startPosition: { row: 1, column: 0 },
						endPosition: { row: 3, column: 1 },
						text: "function testFunction() { return true; }",
						childForFieldName: () => ({ text: "testFunction" }),
						children: [],
					},
					{
						type: "class",
						startPosition: { row: 5, column: 0 },
						endPosition: { row: 9, column: 1 },
						text: "class TestClass { constructor() {} }",
						childForFieldName: () => ({ text: "TestClass" }),
						children: [],
					},
				],
			},
		}
	}
}

// Mock the Query class
export class MockQuery {
	constructor(public pattern: string) {}

	captures(node: any) {
		return [
			{
				node: {
					type: "function",
					startPosition: { row: 1, column: 0 },
					endPosition: { row: 3, column: 1 },
					text: "function testFunction() { return true; }",
					childForFieldName: () => ({ text: "testFunction" }),
					children: [],
				},
			},
			{
				node: {
					type: "class",
					startPosition: { row: 5, column: 0 },
					endPosition: { row: 9, column: 1 },
					text: "class TestClass { constructor() {} }",
					childForFieldName: () => ({ text: "TestClass" }),
					children: [],
				},
			},
		]
	}
}

// Mock the language parser
export const mockLanguageParser = {
	js: {
		parser: new MockParser(),
		query: new MockQuery("(function) (class)"),
	},
	ts: {
		parser: new MockParser(),
		query: new MockQuery("(function) (class)"),
	},
	py: {
		parser: new MockParser(),
		query: new MockQuery("(function) (class)"),
	},
}

// Mock the loadRequiredLanguageParsers function
export const mockLoadRequiredLanguageParsers = jest
	.fn<(filePaths: string[]) => Record<string, any>>()
	.mockImplementation((filePaths: string[]) => {
		const result: Record<string, any> = {}

		// Extract extensions from file paths
		const extensions = filePaths.map((path) => {
			const parts = path.split(".")
			return parts[parts.length - 1]
		})

		for (const ext of extensions) {
			if (ext === "js" || ext === "ts" || ext === "py") {
				result[ext] = mockLanguageParser[ext]
			}
		}

		// Add a matches method to the query objects
		for (const key in result) {
			if (result[key] && result[key].query) {
				result[key].query.matches = jest.fn().mockImplementation((node) => {
					return [
						{
							captures: [
								{
									name: "definition.function_declaration",
									node: {
										text: 'function smallFunction() { console.log("small"); }',
										startPosition: { row: 1, column: 0 },
										endPosition: { row: 3, column: 1 },
										childForFieldName: () => ({ text: "smallFunction" }),
										children: [{ type: "identifier", text: "smallFunction" }],
										type: "function_declaration",
									},
								},
								{
									name: "name.function_declaration",
									node: { text: "smallFunction" },
								},
							],
						},
						{
							captures: [
								{
									name: "definition.class_declaration",
									node: {
										text: 'class MyClass { constructor() { console.log("init"); } }',
										startPosition: { row: 6, column: 0 },
										endPosition: { row: 126, column: 1 },
										childForFieldName: () => ({ text: "MyClass" }),
										children: [
											{ type: "identifier", text: "MyClass" },
											{
												type: "method_definition",
												text: 'constructor() { console.log("init"); }',
												startPosition: { row: 7, column: 2 },
												endPosition: { row: 9, column: 3 },
												childForFieldName: () => ({ text: "constructor" }),
												children: [{ type: "identifier", text: "constructor" }],
											},
											{
												type: "method_definition",
												text: "mediumMethod() { const x = 1; const y = 2; const z = 3; return x + y + z; }",
												startPosition: { row: 12, column: 2 },
												endPosition: { row: 17, column: 3 },
												childForFieldName: () => ({ text: "mediumMethod" }),
												children: [{ type: "identifier", text: "mediumMethod" }],
											},
											{
												type: "method_definition",
												text: "anotherMethod() { /* large method content */ }",
												startPosition: { row: 24, column: 2 },
												endPosition: { row: 124, column: 3 },
												childForFieldName: () => ({ text: "anotherMethod" }),
												children: [{ type: "identifier", text: "anotherMethod" }],
											},
										],
									},
								},
								{
									name: "name.class_declaration",
									node: { text: "MyClass" },
								},
							],
						},
						{
							captures: [
								{
									name: "definition.method_definition",
									node: {
										text: 'constructor() { console.log("init"); }',
										startPosition: { row: 7, column: 2 },
										endPosition: { row: 9, column: 3 },
										childForFieldName: () => ({ text: "constructor" }),
										children: [{ type: "identifier", text: "constructor" }],
										type: "method_definition",
									},
								},
								{
									name: "name.method_definition",
									node: { text: "constructor" },
								},
							],
						},
						{
							captures: [
								{
									name: "definition.method_definition",
									node: {
										text: "mediumMethod() { const x = 1; const y = 2; const z = 3; return x + y + z; }",
										startPosition: { row: 12, column: 2 },
										endPosition: { row: 17, column: 3 },
										childForFieldName: () => ({ text: "mediumMethod" }),
										children: [{ type: "identifier", text: "mediumMethod" }],
										type: "method_definition",
									},
								},
								{
									name: "name.method_definition",
									node: { text: "mediumMethod" },
								},
							],
						},
						{
							captures: [
								{
									name: "definition.method_definition",
									node: {
										text: "anotherMethod() { /* large method content */ }",
										startPosition: { row: 24, column: 2 },
										endPosition: { row: 124, column: 3 },
										childForFieldName: () => ({ text: "anotherMethod" }),
										children: [{ type: "identifier", text: "anotherMethod" }],
										type: "method_definition",
									},
								},
								{
									name: "name.method_definition",
									node: { text: "anotherMethod" },
								},
							],
						},
					]
				})
			}
		}

		return result
	})
