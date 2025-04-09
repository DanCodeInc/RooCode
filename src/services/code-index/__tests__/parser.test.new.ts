import { readFile } from 'fs/promises';
import { createHash } from 'crypto';
import { CodeParser } from '../processors/parser';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockLoadRequiredLanguageParsers } from './mocks/tree-sitter-mock';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../tree-sitter/languageParser', () => ({
    loadRequiredLanguageParsers: mockLoadRequiredLanguageParsers
}));
jest.mock('../../tree-sitter/queries', () => ({
    js: '(function) (class)',
    ts: '(function) (class)',
    py: '(function) (class)'
}));

describe('CodeParser', () => {
    let parser: CodeParser;
    const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;
    
    beforeEach(() => {
        parser = new CodeParser();
        
        // Reset mocks
        jest.resetAllMocks();
        mockedReadFile.mockClear();
    });
    
    describe('parseFile', () => {
        it('should return empty array for unsupported file extensions', async () => {
            // Arrange
            const filePath = 'test.unsupported';
            
            // Act
            const result = await parser.parseFile(filePath);
            
            // Assert
            expect(result).toEqual([]);
            expect(mockedReadFile).not.toHaveBeenCalled();
        });
        
        it('should use provided content and hash if available', async () => {
            // Arrange
            const filePath = 'test.js';
            const content = 'function test() { return true; }';
            const fileHash = 'test-hash';
            
            // Mock the private methods
            (parser as any).isSupportedLanguage = jest.fn().mockReturnValue(true);
            (parser as any).parseContent = jest.fn().mockResolvedValue([]);
            
            // Act
            await parser.parseFile(filePath, { content, fileHash });
            
            // Assert
            expect(mockedReadFile).not.toHaveBeenCalled();
            expect((parser as any).parseContent).toHaveBeenCalledWith(
                filePath,
                content,
                fileHash,
                expect.any(Number),
                expect.any(Number)
            );
        });
        
        it('should read file content if not provided', async () => {
            // Arrange
            const filePath = 'test.js';
            const content = 'function test() { return true; }';
            
            // Mock dependencies
            mockedReadFile.mockResolvedValue(content);
            (parser as any).isSupportedLanguage = jest.fn().mockReturnValue(true);
            (parser as any).createFileHash = jest.fn().mockReturnValue('generated-hash');
            (parser as any).parseContent = jest.fn().mockResolvedValue([]);
            
            // Act
            await parser.parseFile(filePath);
            
            // Assert
            expect(mockedReadFile).toHaveBeenCalledWith(filePath, 'utf8');
            expect((parser as any).parseContent).toHaveBeenCalledWith(
                filePath,
                content,
                'generated-hash',
                expect.any(Number),
                expect.any(Number)
            );
        });
        
        it('should handle file read errors', async () => {
            // Arrange
            const filePath = 'test.js';
            const error = new Error('File not found');
            
            // Mock dependencies
            mockedReadFile.mockRejectedValue(error);
            (parser as any).isSupportedLanguage = jest.fn().mockReturnValue(true);
            
            // Mock console.error to avoid polluting test output
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            // Act
            const result = await parser.parseFile(filePath);
            
            // Assert
            expect(result).toEqual([]);
            expect(consoleErrorSpy).toHaveBeenCalled();
            
            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
        
        it('should parse JavaScript files correctly', async () => {
            // Arrange
            const filePath = 'test.js';
            const content = 'function testFunction() { return true; }';
            const fileHash = createHash('sha256').update(content).digest('hex');
            
            // Mock dependencies
            mockedReadFile.mockResolvedValue(content);
            
            // Act
            const result = await parser.parseFile(filePath);
            
            // Assert
            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toMatchObject({
                file_path: filePath,
                type: 'function',
                identifier: 'testFunction',
                fileHash
            });
        });
        
        it('should parse TypeScript files correctly', async () => {
            // Arrange
            const filePath = 'test.ts';
            const content = 'class TestClass { constructor() {} }';
            const fileHash = createHash('sha256').update(content).digest('hex');
            
            // Mock dependencies
            mockedReadFile.mockResolvedValue(content);
            
            // Act
            const result = await parser.parseFile(filePath);
            
            // Assert
            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toMatchObject({
                file_path: filePath,
                type: 'class',
                identifier: 'TestClass',
                fileHash
            });
        });
    });
});
