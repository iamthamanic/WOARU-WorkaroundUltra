// @ts-nocheck
import { AIReviewAgent } from '../../src/ai/AIReviewAgent';
import { ConfigLoader } from '../../src/ai/ConfigLoader';
import { UsageTracker } from '../../src/ai/UsageTracker';
import axios from 'axios';
import path from 'path';
import fs from 'fs-extra';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock fs-extra
jest.mock('fs-extra', () => ({
  readFile: jest.fn(),
  pathExists: jest.fn()
}));
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock ConfigLoader
jest.mock('../../src/ai/ConfigLoader');
const MockedConfigLoader = ConfigLoader as jest.MockedClass<typeof ConfigLoader>;

// Mock UsageTracker
jest.mock('../../src/ai/UsageTracker');
const MockedUsageTracker = UsageTracker as jest.MockedClass<typeof UsageTracker>;

describe('AIReviewAgent Integration Tests', () => {
  let aiReviewAgent: AIReviewAgent;
  let mockConfigLoader: jest.Mocked<ConfigLoader>;
  let mockUsageTracker: jest.Mocked<UsageTracker>;
  
  const mockProjectPath = '/test/project/path';
  const mockConfig = {
    providers: [
      {
        id: 'openai-gpt4',
        providerType: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        enabled: true,
        apiKeyEnvVar: 'OPENAI_API_KEY',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json'
        },
        bodyTemplate: JSON.stringify({
          model: '{{model}}',
          messages: '{{messages}}',
          temperature: '{{temperature}}',
          max_tokens: '{{maxTokens}}'
        }),
        timeout: 30000,
        maxTokens: 4000,
        temperature: 0.1
      },
      {
        id: 'anthropic-claude',
        providerType: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-opus-20240229',
        enabled: true,
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
        headers: {
          'x-api-key': 'test-api-key',
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        bodyTemplate: JSON.stringify({
          model: '{{model}}',
          messages: '{{messages}}',
          temperature: '{{temperature}}',
          max_tokens: '{{maxTokens}}'
        }),
        timeout: 30000,
        maxTokens: 4000,
        temperature: 0.1
      }
    ],
    parallelRequests: true,
    consensusMode: false,
    minConsensusCount: 2,
    tokenLimit: 100000,
    costThreshold: 10.0
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup ConfigLoader mock
    mockConfigLoader = {
      loadConfig: jest.fn().mockResolvedValue(mockConfig),
      hasValidConfig: jest.fn().mockResolvedValue(true)
    } as any;
    
    MockedConfigLoader.getInstance.mockReturnValue(mockConfigLoader);
    
    // Setup UsageTracker mock
    mockUsageTracker = {
      recordUsage: jest.fn().mockResolvedValue(undefined),
      getTotalUsage: jest.fn().mockResolvedValue({
        totalRequests: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        totalErrors: 0
      })
    } as any;
    
    MockedUsageTracker.getInstance.mockReturnValue(mockUsageTracker);
    
    // Setup fs mock
    mockedFs.readFile.mockResolvedValue('test file content');
    mockedFs.pathExists.mockResolvedValue(true);
    
    // Create AIReviewAgent instance
    aiReviewAgent = new AIReviewAgent(mockProjectPath);
    
    // Set environment variables for API keys
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('performMultiLLMReview', () => {
    it('should successfully call multiple LLM providers when multi-AI is enabled', async () => {
      // Mock successful API responses
      const mockOpenAIResponse = {
        data: {
          choices: [{
            message: {
              content: 'OpenAI review: The code looks good with minor improvements needed.'
            }
          }],
          usage: {
            total_tokens: 150
          }
        }
      };
      
      const mockAnthropicResponse = {
        data: {
          content: [{
            text: 'Anthropic review: Code structure is solid, consider adding more tests.'
          }],
          usage: {
            output_tokens: 100,
            input_tokens: 50
          }
        }
      };
      
      // Setup axios mocks
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('openai.com')) {
          return Promise.resolve(mockOpenAIResponse);
        } else if (url.includes('anthropic.com')) {
          return Promise.resolve(mockAnthropicResponse);
        }
        return Promise.reject(new Error('Unknown API endpoint'));
      });
      
      const changedFiles = ['/test/project/path/src/test.js'];
      const context = {
        filePath: '/test/project/path/src/test.js',
        language: 'javascript',
        totalLines: 100,
        projectContext: {
          name: 'test-project',
          type: 'application' as const,
          dependencies: ['react']
        }
      };
      const result = await aiReviewAgent.performMultiLLMReview(changedFiles, context);
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.reviews).toBeDefined();
      expect(result.reviews).toHaveLength(2);
      
      // Verify OpenAI review
      const openAIReview = result.reviews.find(r => r.provider === 'openai-gpt4');
      expect(openAIReview).toBeDefined();
      expect(openAIReview?.success).toBe(true);
      expect(openAIReview?.content).toContain('OpenAI review');
      
      // Verify Anthropic review
      const anthropicReview = result.reviews.find(r => r.provider === 'anthropic-claude');
      expect(anthropicReview).toBeDefined();
      expect(anthropicReview?.success).toBe(true);
      expect(anthropicReview?.content).toContain('Anthropic review');
      
      // Verify API calls were made
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      
      // Verify usage tracking
      expect(mockUsageTracker.recordUsage).toHaveBeenCalledTimes(2);
    });

    it('should handle API errors gracefully', async () => {
      // Mock one successful and one failed response
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('openai.com')) {
          return Promise.resolve({
            data: {
              choices: [{
                message: {
                  content: 'OpenAI review successful'
                }
              }],
              usage: {
                total_tokens: 100
              }
            }
          });
        } else if (url.includes('anthropic.com')) {
          return Promise.reject(new Error('API rate limit exceeded'));
        }
        return Promise.reject(new Error('Unknown API endpoint'));
      });
      
      const changedFiles = ['/test/project/path/src/test.js'];
      const context = {
        filePath: '/test/project/path/src/test.js',
        language: 'javascript',
        totalLines: 100,
        projectContext: {
          name: 'test-project',
          type: 'application' as const,
          dependencies: ['react']
        }
      };
      const result = await aiReviewAgent.performMultiLLMReview(changedFiles, context);
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.success).toBe(true); // Should still succeed with partial results
      expect(result.reviews).toHaveLength(2);
      
      // Verify successful review
      const openAIReview = result.reviews.find(r => r.provider === 'openai-gpt4');
      expect(openAIReview?.success).toBe(true);
      
      // Verify failed review
      const anthropicReview = result.reviews.find(r => r.provider === 'anthropic-claude');
      expect(anthropicReview?.success).toBe(false);
      expect(anthropicReview?.error).toContain('rate limit');
    });

    it('should respect single provider mode when multi-AI is disabled', async () => {
      // Update config to disable multi-AI
      const singleProviderConfig = {
        ...mockConfig,
        multiAIReviewEnabled: false,
        primaryReviewProviderId: 'openai-gpt4'
      };
      mockConfigLoader.loadConfig.mockResolvedValue(singleProviderConfig);
      
      // Mock API response
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: {
              content: 'Single provider review'
            }
          }],
          usage: {
            total_tokens: 100
          }
        }
      });
      
      const changedFiles = ['/test/project/path/src/test.js'];
      const context = {
        filePath: '/test/project/path/src/test.js',
        language: 'javascript',
        totalLines: 100,
        projectContext: {
          name: 'test-project',
          type: 'application' as const,
          dependencies: ['react']
        }
      };
      const result = await aiReviewAgent.performMultiLLMReview(changedFiles, context);
      
      // Verify only one API call was made
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].provider).toBe('openai-gpt4');
    });

    it('should handle empty file list', async () => {
      const result = await aiReviewAgent.performMultiLLMReview([]);
      
      expect(result.success).toBe(true);
      expect(result.reviews).toHaveLength(0);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should parse different LLM response formats correctly', async () => {
      // Test different response structures from various providers
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('openai.com')) {
          // OpenAI format
          return Promise.resolve({
            data: {
              choices: [{
                message: {
                  content: 'OpenAI formatted response',
                  role: 'assistant'
                },
                finish_reason: 'stop'
              }],
              usage: {
                prompt_tokens: 50,
                completion_tokens: 100,
                total_tokens: 150
              }
            }
          });
        } else if (url.includes('anthropic.com')) {
          // Anthropic format
          return Promise.resolve({
            data: {
              content: [{
                type: 'text',
                text: 'Anthropic formatted response'
              }],
              stop_reason: 'end_turn',
              usage: {
                input_tokens: 50,
                output_tokens: 100
              }
            }
          });
        }
        return Promise.reject(new Error('Unknown API endpoint'));
      });
      
      const changedFiles = ['/test/project/path/src/test.js'];
      const context = {
        filePath: '/test/project/path/src/test.js',
        language: 'javascript',
        totalLines: 100,
        projectContext: {
          name: 'test-project',
          type: 'application' as const,
          dependencies: ['react']
        }
      };
      const result = await aiReviewAgent.performMultiLLMReview(changedFiles, context);
      
      // Verify both responses were parsed correctly
      expect(result.reviews).toHaveLength(2);
      
      const openAIReview = result.reviews.find(r => r.provider === 'openai-gpt4');
      expect(openAIReview?.content).toBe('OpenAI formatted response');
      expect(openAIReview?.tokensUsed).toBe(150);
      
      const anthropicReview = result.reviews.find(r => r.provider === 'anthropic-claude');
      expect(anthropicReview?.content).toBe('Anthropic formatted response');
      expect(anthropicReview?.tokensUsed).toBe(150); // input + output
    });
  });

  describe('Configuration handling', () => {
    it('should handle missing API keys', async () => {
      // Remove API keys
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      const changedFiles = ['/test/project/path/src/test.js'];
      const context = {
        filePath: '/test/project/path/src/test.js',
        language: 'javascript',
        totalLines: 100,
        projectContext: {
          name: 'test-project',
          type: 'application' as const,
          dependencies: ['react']
        }
      };
      const result = await aiReviewAgent.performMultiLLMReview(changedFiles, context);
      
      // Should skip providers without API keys
      expect(result.reviews).toHaveLength(0);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should respect provider enabled/disabled state', async () => {
      // Disable one provider
      const configWithDisabled = {
        ...mockConfig,
        providers: [
          { ...mockConfig.providers[0], enabled: true },
          { ...mockConfig.providers[1], enabled: false }
        ]
      };
      mockConfigLoader.loadConfig.mockResolvedValue(configWithDisabled);
      
      mockedAxios.post.mockResolvedValue({
        data: {
          choices: [{
            message: { content: 'Test response' }
          }],
          usage: { total_tokens: 100 }
        }
      });
      
      const changedFiles = ['/test/project/path/src/test.js'];
      const context = {
        filePath: '/test/project/path/src/test.js',
        language: 'javascript',
        totalLines: 100,
        projectContext: {
          name: 'test-project',
          type: 'application' as const,
          dependencies: ['react']
        }
      };
      const result = await aiReviewAgent.performMultiLLMReview(changedFiles, context);
      
      // Should only call enabled provider
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].provider).toBe('openai-gpt4');
    });
  });
});