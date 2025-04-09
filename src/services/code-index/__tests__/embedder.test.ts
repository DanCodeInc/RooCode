import { OpenAiEmbedder } from '../embedders/openai-embedder';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OpenAI } from 'openai';

// Mock dependencies
jest.mock('openai');

describe('OpenAiEmbedder', () => {
    let embedder: OpenAiEmbedder;
    
    beforeEach(() => {
        // Reset mocks
        jest.resetAllMocks();
        
        // Create embedder with mock options
        embedder = new OpenAiEmbedder({ openAiNativeApiKey: 'test-key' });
    });
    
    describe('createEmbeddings', () => {
        it('should create embeddings successfully', async () => {
            // Arrange
            const texts = ['test text 1', 'test text 2'];
            const mockResponse = {
                data: [
                    { embedding: [0.1, 0.2, 0.3] },
                    { embedding: [0.4, 0.5, 0.6] }
                ],
                usage: {
                    prompt_tokens: 10,
                    total_tokens: 20
                }
            };
            
            // Mock OpenAI client
            (OpenAI.prototype.embeddings.create as jest.Mock).mockResolvedValue(mockResponse);
            
            // Act
            const result = await embedder.createEmbeddings(texts);
            
            // Assert
            expect(result).toEqual({
                embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
                usage: {
                    prompt_tokens: 10,
                    total_tokens: 20
                }
            });
            expect(OpenAI.prototype.embeddings.create).toHaveBeenCalledWith({
                input: texts,
                model: 'text-embedding-3-small'
            });
        });
        
        it('should handle API errors', async () => {
            // Arrange
            const texts = ['test text'];
            const error = new Error('API error');
            
            // Mock OpenAI client
            (OpenAI.prototype.embeddings.create as jest.Mock).mockRejectedValue(error);
            
            // Mock console.error to avoid polluting test output
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Act & Assert
            await expect(embedder.createEmbeddings(texts)).rejects.toThrow('Failed to create embeddings');
            expect(consoleErrorSpy).toHaveBeenCalled();
            
            // Restore console.error
            consoleErrorSpy.mockRestore();
        });
        
        it('should use custom model if provided', async () => {
            // Arrange
            const texts = ['test text'];
            const customModel = 'text-embedding-ada-002';
            const mockResponse = {
                data: [{ embedding: [0.1, 0.2, 0.3] }],
                usage: {
                    prompt_tokens: 5,
                    total_tokens: 10
                }
            };
            
            // Mock OpenAI client
            (OpenAI.prototype.embeddings.create as jest.Mock).mockResolvedValue(mockResponse);
            
            // Act
            await embedder.createEmbeddings(texts, customModel);
            
            // Assert
            expect(OpenAI.prototype.embeddings.create).toHaveBeenCalledWith({
                input: texts,
                model: customModel
            });
        });
    });
});
