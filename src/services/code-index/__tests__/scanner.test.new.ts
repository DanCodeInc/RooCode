import * as vscode from 'vscode';
import * as path from 'path';
import { DirectoryScanner } from '../processors/scanner';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockLoadRequiredLanguageParsers } from './mocks/tree-sitter-mock';
import { RooIgnoreController } from '../../../core/ignore/RooIgnoreController';

// Mock dependencies
jest.mock('vscode');
jest.mock('../../../utils/path', () => ({
    getWorkspacePath: jest.fn().mockReturnValue('/test/workspace')
}));
jest.mock('../../../core/ignore/RooIgnoreController', () => {
    return {
        RooIgnoreController: jest.fn().mockImplementation(() => ({
            validateAccess: jest.fn().mockReturnValue(true)
        }))
    };
});
jest.mock('../../tree-sitter/languageParser', () => ({
    loadRequiredLanguageParsers: mockLoadRequiredLanguageParsers
}));
jest.mock('../../glob/list-files', () => ({
    listFiles: jest.fn().mockResolvedValue([
        [
            '/test/workspace/file1.js',
            '/test/workspace/file2.ts',
            '/test/workspace/file3.py'
        ],
        false
    ])
}));
jest.mock('fs/promises', () => ({
    stat: jest.fn().mockResolvedValue({ size: 1000 })
}));
jest.mock('../processors/parser', () => ({
    codeParser: {
        parseFile: jest.fn().mockImplementation(async (filePath) => {
            if (filePath.endsWith('.js')) {
                return [
                    {
                        file_path: filePath,
                        identifier: 'jsFunction',
                        type: 'function',
                        start_line: 1,
                        end_line: 5,
                        content: 'function jsFunction() { return true; }',
                        fileHash: 'js-hash',
                        segmentHash: 'js-segment-hash'
                    }
                ];
            } else if (filePath.endsWith('.ts')) {
                return [
                    {
                        file_path: filePath,
                        identifier: 'tsClass',
                        type: 'class',
                        start_line: 1,
                        end_line: 10,
                        content: 'class tsClass { constructor() {} }',
                        fileHash: 'ts-hash',
                        segmentHash: 'ts-segment-hash'
                    }
                ];
            } else {
                return [
                    {
                        file_path: filePath,
                        identifier: 'pyFunction',
                        type: 'function',
                        start_line: 1,
                        end_line: 3,
                        content: 'def pyFunction(): return True',
                        fileHash: 'py-hash',
                        segmentHash: 'py-segment-hash'
                    }
                ];
            }
        })
    }
}));

describe('DirectoryScanner', () => {
    let scanner: DirectoryScanner;
    let mockEmbedder: any;
    let mockVectorStore: any;
    let mockContext: any;
    
    beforeEach(() => {
        // Reset mocks
        jest.resetAllMocks();
        
        // Create mock context
        mockContext = {
            globalState: {
                get: jest.fn().mockReturnValue({}),
                update: jest.fn().mockResolvedValue(undefined)
            }
        };
        
        // Create mock embedder
        mockEmbedder = {
            createEmbeddings: jest.fn().mockResolvedValue({
                embeddings: [
                    [0.1, 0.2, 0.3],
                    [0.4, 0.5, 0.6],
                    [0.7, 0.8, 0.9]
                ],
                usage: { prompt_tokens: 30, total_tokens: 60 }
            })
        };
        
        // Create mock vector store
        mockVectorStore = {
            deletePointsByFilePath: jest.fn().mockResolvedValue(undefined),
            upsertPoints: jest.fn().mockResolvedValue(undefined)
        };
        
        // Create scanner
        scanner = new DirectoryScanner('/test/workspace', {
            embedder: mockEmbedder,
            vectorStore: mockVectorStore,
            context: mockContext
        });
    });
    
    describe('scanDirectory', () => {
        it('should scan a directory correctly', async () => {
            // Arrange
            const onProgress = jest.fn();
            const onError = jest.fn();
            
            // Act
            const result = await scanner.scanDirectory({
                onProgress,
                onError
            });
            
            // Assert
            expect(result.codeBlocks.length).toBe(3);
            expect(result.stats.processed).toBe(3);
            expect(result.stats.skipped).toBe(0);
            expect(mockEmbedder.createEmbeddings).toHaveBeenCalled();
            expect(mockVectorStore.deletePointsByFilePath).toHaveBeenCalled();
            expect(mockVectorStore.upsertPoints).toHaveBeenCalled();
            expect(onProgress).toHaveBeenCalled();
            expect(onError).not.toHaveBeenCalled();
        });
        
        it('should handle errors during scanning', async () => {
            // Arrange
            const onProgress = jest.fn();
            const onError = jest.fn();
            
            // Mock codeParser.parseFile to throw an error for one file
            const mockParseFile = require('../processors/parser').codeParser.parseFile;
            mockParseFile.mockRejectedValueOnce(new Error('Parse error'));
            
            // Act
            const result = await scanner.scanDirectory({
                onProgress,
                onError
            });
            
            // Assert
            expect(result.codeBlocks.length).toBe(2);
            expect(result.stats.processed).toBe(2);
            expect(result.stats.skipped).toBe(1);
            expect(onError).toHaveBeenCalled();
        });
        
        it('should handle errors during embedding', async () => {
            // Arrange
            const onProgress = jest.fn();
            const onError = jest.fn();
            
            // Mock embedder.createEmbeddings to throw an error
            mockEmbedder.createEmbeddings.mockRejectedValueOnce(new Error('Embedding error'));
            
            // Act
            const result = await scanner.scanDirectory({
                onProgress,
                onError
            });
            
            // Assert
            expect(result.codeBlocks.length).toBe(3);
            expect(result.stats.processed).toBe(3);
            expect(result.stats.skipped).toBe(0);
            expect(onError).toHaveBeenCalled();
        });
    });
});
