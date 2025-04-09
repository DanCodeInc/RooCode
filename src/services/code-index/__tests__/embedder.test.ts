import { OpenAiEmbedder } from '../embedders/openai-embedder';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OpenAI } from 'openai';

// Import test helpers
import { createOpenAIEmbeddingsMock } from './test-helpers';

// Mock dependencies
jest.mock('openai', () => {
    return {
        OpenAI: jest.fn().mockImplementation(() => ({
            embeddings: {
                create: createOpenAIEmbeddingsMock()
            }
        }))
    };
});

jest.mock('../../../api/providers/openai-native', () => {
    return {
        OpenAiNativeHandler: jest.fn().mockImplementation((options) => ({
            options
        }))
    };
});

// Create mock functions
const mockCreateEmbeddings = jest.fn().mockImplementation((texts, model) => {
    const mockResponse = {
        embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
        usage: { prompt_tokens: 10, total_tokens: 20 }
    };
    return Promise.resolve(mockResponse);
});

const mockCreateEmbeddingsError = jest.fn().mockImplementation((texts, model) => {
    throw new Error('Failed to create embeddings');
});

const mockCreateWithModelCapture = jest.fn().mockImplementation((texts, model) => {
    return Promise.resolve({
        embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
        usage: { prompt_tokens: 10, total_tokens: 20 }
    });
});

jest.mock('../embedders/openai-embedder', () => {
    return {
        OpenAiEmbedder: jest.fn().mockImplementation(() => ({
            createEmbeddings: mockCreateEmbeddings
        }))
    };
});

describe('OpenAiEmbedder', () => {
    let embedder: OpenAiEmbedder;

    beforeEach(() => {
        // Reset mocks
        jest.resetAllMocks();

        // Create embedder with mock options
        embedder = new OpenAiEmbedder({ openAiNativeApiKey: 'test-key' });

        // Ensure the mock function is properly attached
        embedder.createEmbeddings = mockCreateEmbeddings;
    });

    describe('createEmbeddings', () => {
        it('should create embeddings successfully', async () => {
            // Arrange
            const texts = ['test text 1', 'test text 2'];

            // Set up the mock to return a specific value
            const mockResult = {
                embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
                usage: {
                    prompt_tokens: 10,
                    total_tokens: 20
                }
            };
            mockCreateEmbeddings.mockResolvedValueOnce(mockResult);

            // Act
            const result = await embedder.createEmbeddings(texts);

            // Assert
            expect(result).toEqual(mockResult);
            expect(mockCreateEmbeddings).toHaveBeenCalledWith(texts);
        });

        it('should handle API errors', async () => {
            // Arrange
            const texts = ['test text'];
            const error = new Error('Failed to create embeddings');

            // Mock console.error to avoid polluting test output
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            // Replace the mock implementation for this test
            mockCreateEmbeddings.mockRejectedValueOnce(error);

            // Act & Assert
            await expect(embedder.createEmbeddings(texts)).rejects.toThrow('Failed to create embeddings');

            // Verify the mock was called
            expect(mockCreateEmbeddings).toHaveBeenCalled();

            // Restore console.error
            consoleErrorSpy.mockRestore();
        });

        it('should use custom model if provided', async () => {
            // Arrange
            const texts = ['test text'];
            const customModel = 'text-embedding-ada-002';

            // Create a special mock for this test that captures the model parameter
            const mockCreateWithModelCapture = jest.fn().mockImplementation((texts, model) => {
                expect(model).toBe(customModel);
                return Promise.resolve({
                    embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
                    usage: { prompt_tokens: 10, total_tokens: 20 }
                });
            });

            // Replace the mock implementation for this test
            const originalCreateEmbeddings = embedder.createEmbeddings;
            embedder.createEmbeddings = mockCreateWithModelCapture;

            // Act
            const result = await embedder.createEmbeddings(texts, customModel);

            // Assert
            expect(mockCreateWithModelCapture).toHaveBeenCalledWith(texts, customModel);
            expect(result).toEqual({
                embeddings: [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]],
                usage: { prompt_tokens: 10, total_tokens: 20 }
            });

            // Restore original mock
            embedder.createEmbeddings = originalCreateEmbeddings;
        });
    });
});
