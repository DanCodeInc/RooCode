import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock the fs/promises module
const mockReadFile = jest.fn().mockResolvedValue('mock file content');
jest.mock('fs/promises', () => ({
    readFile: mockReadFile
}));

// Mock the tree-sitter queries
jest.mock('../../tree-sitter/queries', () => ({
    jsQuery: '(function_declaration) @definition.function_declaration (identifier) @name.function_declaration',
    tsQuery: '(function_declaration) @definition.function_declaration (identifier) @name.function_declaration',
    pyQuery: '(function_definition) @definition.function_definition (identifier) @name.function_definition'
}));

// Mock the tree-sitter language parser
const mockLanguageParser = {
    loadRequiredLanguageParsers: jest.fn().mockImplementation((filePaths) => {
        const mockQuery = {
            matches: jest.fn().mockReturnValue([
                {
                    captures: [
                        {
                            name: 'definition.function_declaration',
                            node: {
                                text: 'function test() { return true; }',
                                startPosition: { row: 1, column: 0 },
                                endPosition: { row: 3, column: 1 },
                                childForFieldName: () => ({ text: 'test' }),
                                children: [{ type: 'identifier', text: 'test' }],
                                type: 'function_declaration'
                            }
                        },
                        {
                            name: 'name.function_declaration',
                            node: { text: 'test' }
                        }
                    ]
                }
            ])
        };

        const mockParser = {
            parse: jest.fn().mockImplementation((content) => ({
                rootNode: {
                    text: content,
                    children: [],
                    startPosition: { row: 0, column: 0 },
                    endPosition: { row: content.split('\n').length - 1, column: 0 }
                }
            })),
            getLanguage: jest.fn().mockImplementation(() => ({
                query: jest.fn().mockReturnValue(mockQuery)
            }))
        };

        // Return mock parsers for each supported extension
        const result = {};
        for (const path of filePaths) {
            const ext = path.split('.').pop();
            if (ext) {
                result[ext] = { parser: mockParser, query: mockQuery };
            }
        }
        return result;
    })
};

jest.mock('../../tree-sitter/languageParser', () => mockLanguageParser);

// Import the module under test after all mocks are set up
const parser = jest.requireActual('../parser');

describe('parseCodeFileByQueries', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return blocks based on query matches', async () => {
        // Arrange
        const filePath = 'test.ts';

        // Act
        const result = await parser.parseCodeFileByQueries(filePath);

        // Assert
        expect(result).toBeInstanceOf(Array);
        expect(mockReadFile).toHaveBeenCalledWith(filePath, 'utf-8');
    });

    it('should handle files with different extensions', async () => {
        // Arrange
        const filePath = 'test.js';

        // Act
        const result = await parser.parseCodeFileByQueries(filePath);

        // Assert
        expect(result).toBeInstanceOf(Array);
        expect(mockReadFile).toHaveBeenCalledWith(filePath, 'utf-8');
    });
});
