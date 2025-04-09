import { jest } from '@jest/globals';

// Mock the Parser class
export class MockParser {
    static Language = {
        load: jest.fn().mockResolvedValue({})
    };

    parse(content: string) {
        return {
            rootNode: {
                startPosition: { row: 0, column: 0 },
                endPosition: { row: 10, column: 0 },
                children: [
                    {
                        type: 'function',
                        startPosition: { row: 1, column: 0 },
                        endPosition: { row: 3, column: 1 },
                        text: 'function testFunction() { return true; }',
                        childForFieldName: () => ({ text: 'testFunction' }),
                        children: []
                    },
                    {
                        type: 'class',
                        startPosition: { row: 5, column: 0 },
                        endPosition: { row: 9, column: 1 },
                        text: 'class TestClass { constructor() {} }',
                        childForFieldName: () => ({ text: 'TestClass' }),
                        children: []
                    }
                ]
            }
        };
    }
}

// Mock the Query class
export class MockQuery {
    constructor(public pattern: string) {}

    captures(node: any) {
        return [
            { 
                node: {
                    type: 'function',
                    startPosition: { row: 1, column: 0 },
                    endPosition: { row: 3, column: 1 },
                    text: 'function testFunction() { return true; }',
                    childForFieldName: () => ({ text: 'testFunction' }),
                    children: []
                }
            },
            {
                node: {
                    type: 'class',
                    startPosition: { row: 5, column: 0 },
                    endPosition: { row: 9, column: 1 },
                    text: 'class TestClass { constructor() {} }',
                    childForFieldName: () => ({ text: 'TestClass' }),
                    children: []
                }
            }
        ];
    }
}

// Mock the language parser
export const mockLanguageParser = {
    js: {
        parser: new MockParser(),
        query: new MockQuery('(function) (class)')
    },
    ts: {
        parser: new MockParser(),
        query: new MockQuery('(function) (class)')
    },
    py: {
        parser: new MockParser(),
        query: new MockQuery('(function) (class)')
    }
};

// Mock the loadRequiredLanguageParsers function
export const mockLoadRequiredLanguageParsers = jest.fn().mockImplementation((extensions: string[]) => {
    const result: Record<string, any> = {};
    
    for (const ext of extensions) {
        if (ext === 'js' || ext === 'ts' || ext === 'py') {
            result[ext] = mockLanguageParser[ext];
        }
    }
    
    return Promise.resolve(result);
});
