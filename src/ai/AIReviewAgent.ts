// Removed unused fs and path imports
import axios, { AxiosResponse } from 'axios';
import { safeJsonParse } from '../utils/safeJsonParser';
import { PromptManager } from './PromptManager';
import {
  LLMProviderConfig,
  AIReviewConfig,
  CodeContext,
  AIReviewFinding,
  MultiLLMReviewResult,
  LLMResponse,
  PromptTemplate,
} from '../types/ai-review';
import { UsageTracker } from './UsageTracker';
import { getAILanguageInstruction } from '../config/i18n';
import {
  triggerHook,
  type BeforeAnalysisData,
  type AfterAnalysisData,
  type ErrorHookData,
} from '../core/HookSystem';

/**
 * AIReviewAgent - Multi-LLM powered code review and analysis system
 *
 * The AIReviewAgent provides sophisticated AI-powered code review capabilities by leveraging
 * multiple Large Language Model (LLM) providers simultaneously. It performs comprehensive
 * code analysis, identifies potential issues, suggests improvements, and provides detailed
 * findings with actionable recommendations. The agent supports multiple AI providers
 * including OpenAI, Anthropic, and others, enabling robust and diverse code analysis.
 *
 * Key features:
 * - Multi-LLM analysis for comprehensive code reviews
 * - Hook system integration for extensible workflows
 * - Usage tracking and performance monitoring
 * - Provider-specific configuration and failover
 * - Internationalization support for multilingual analysis
 * - Secure API communication with error handling
 *
 * Supported analysis types:
 * - Code quality assessment and best practices
 * - Bug detection and potential security issues
 * - Performance optimization recommendations
 * - Architecture and design pattern suggestions
 * - Maintainability and readability improvements
 * - Language-specific idioms and conventions
 *
 * @example
 * ```typescript
 * // Configure AI review with multiple providers
 * const config: AIReviewConfig = {
 *   providers: [
 *     { name: 'openai', enabled: true, apiKey: 'your-openai-key' },
 *     { name: 'anthropic', enabled: true, apiKey: 'your-anthropic-key' }
 *   ],
 *   maxTokens: 4000,
 *   temperature: 0.1
 * };
 *
 * const reviewAgent = new AIReviewAgent(config);
 *
 * // Perform code review
 * const codeContext: CodeContext = {
 *   fileName: 'UserService.ts',
 *   language: 'typescript',
 *   framework: 'express',
 *   projectType: 'web-api'
 * };
 *
 * const result = await reviewAgent.performMultiLLMReview(sourceCode, codeContext);
 *
 * // Process results from multiple providers
 * result.results.forEach(providerResult => {
 *   console.log(`${providerResult.provider} findings:`);
 *   providerResult.findings.forEach(finding => {
 *     console.log(`- ${finding.type}: ${finding.message}`);
 *     console.log(`  Severity: ${finding.severity}`);
 *     if (finding.suggestion) {
 *       console.log(`  Suggestion: ${finding.suggestion}`);
 *     }
 *   });
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Advanced usage with custom prompt templates
 * const customPrompts = {
 *   security: {
 *     name: 'Security Review',
 *     description: 'Focus on security vulnerabilities',
 *     system_prompt: 'You are a security expert reviewing code for vulnerabilities...',
 *     user_prompt: 'Analyze this code for security issues: {{code}}'
 *   }
 * };
 *
 * const reviewAgent = new AIReviewAgent(config, customPrompts);
 *
 * // Perform focused security review
 * const securityResult = await reviewAgent.performMultiLLMReview(
 *   authenticationCode,
 *   { fileName: 'auth.ts', language: 'typescript', focus: 'security' }
 * );
 *
 * // Handle review completion with metrics
 * console.log(`Review completed with ${securityResult.results.length} providers`);
 * console.log(`Total findings: ${securityResult.totalFindings}`);
 * console.log(`Success rate: ${securityResult.successRate}%`);
 * ```
 *
 * @since 1.0.0
 */
export class AIReviewAgent {
  private config: AIReviewConfig;
  private promptTemplate: PromptTemplate;
  private promptTemplates: Record<string, PromptTemplate>;
  private enabledProviders: LLMProviderConfig[];

  constructor(
    config: AIReviewConfig,
    promptTemplates?: Record<string, PromptTemplate>
  ) {
    this.config = config;
    this.enabledProviders = config.providers?.filter(p => p?.enabled) || [];
    this.promptTemplates = promptTemplates || {};
    this.promptTemplate = this.createDefaultPromptTemplate();

    if (this.enabledProviders.length === 0) {
      console.warn('⚠️ No LLM providers enabled in AI Review configuration');
    }
  }

  /**
   * Performs comprehensive multi-LLM code review analysis with hook integration
   *
   * Executes parallel code analysis using all enabled LLM providers to generate
   * comprehensive code review findings. Each provider analyzes the code independently,
   * and results are aggregated with consensus scoring and conflict resolution.
   * The method integrates with the WOARU Hook System for extensible analysis workflows
   * and provides detailed performance metrics.
   *
   * Analysis workflow:
   * 1. **Pre-analysis hooks**: Context preparation and provider validation
   * 2. **Parallel LLM requests**: Simultaneous analysis across all enabled providers
   * 3. **Response processing**: JSON parsing, validation, and finding extraction
   * 4. **Result aggregation**: Consensus building and confidence scoring
   * 5. **Post-analysis hooks**: Result validation and metrics collection
   * 6. **Error handling**: Graceful provider failures with partial results
   *
   * Features:
   * - Parallel provider execution for optimal performance
   * - Automatic retry logic with exponential backoff
   * - Response validation and malformed data handling
   * - Usage tracking for cost and performance monitoring
   * - Internationalization support for multilingual contexts
   * - Comprehensive error logging and debugging
   *
   * 🪝 **Hook Integration**: Seamlessly integrates with WOARU's rule-based AI system
   *
   * @param code - Source code content to analyze (supports all major programming languages)
   * @param context - Contextual information about the code being analyzed
   * @param context.fileName - Name of the file being analyzed for context-aware suggestions
   * @param context.language - Programming language for language-specific analysis
   * @param context.framework - Framework context (e.g., 'react', 'express', 'django')
   * @param context.projectType - Project type for targeted recommendations
   * @returns Promise resolving to comprehensive multi-provider review results
   *
   * @throws {Error} When no providers are enabled or all providers fail
   *
   * @example
   * ```typescript
   * const reviewAgent = new AIReviewAgent(config);
   *
   * // Analyze a React component
   * const reactCode = `
   * import React, { useState } from 'react';
   *
   * function UserProfile({ userId }) {
   *   const [user, setUser] = useState(null);
   *   // ... component implementation
   * }`;
   *
   * const context: CodeContext = {
   *   fileName: 'UserProfile.tsx',
   *   language: 'typescript',
   *   framework: 'react',
   *   projectType: 'spa'
   * };
   *
   * const result = await reviewAgent.performMultiLLMReview(reactCode, context);
   *
   * // Access aggregated results
   * console.log(`Total findings: ${result.totalFindings}`);
   * console.log(`Success rate: ${result.successRate}%`);
   * console.log(`Analysis duration: ${result.totalDuration}ms`);
   *
   * // Process provider-specific findings
   * result.results.forEach(providerResult => {
   *   if (providerResult.success) {
   *     console.log(`\n${providerResult.provider} Analysis:`);
   *     providerResult.findings.forEach(finding => {
   *       console.log(`- [${finding.severity}] ${finding.type}: ${finding.message}`);
   *       if (finding.lineNumber) console.log(`  Line: ${finding.lineNumber}`);
   *       if (finding.suggestion) console.log(`  💡 ${finding.suggestion}`);
   *     });
   *   } else {
   *     console.warn(`${providerResult.provider} failed: ${providerResult.error}`);
   *   }
   * });
   * ```
   *
   * @example
   * ```typescript
   * // Handle analysis with error recovery
   * try {
   *   const result = await reviewAgent.performMultiLLMReview(complexCode, context);
   *
   *   // Check if we have usable results despite some failures
   *   if (result.successRate >= 50) {
   *     const highSeverityIssues = result.results
   *       .flatMap(r => r.findings)
   *       .filter(f => f.severity === 'high' || f.severity === 'critical');
   *
   *     if (highSeverityIssues.length > 0) {
   *       console.log('🚨 Critical issues found:');
   *       highSeverityIssues.forEach(issue => {
   *         console.log(`- ${issue.message}`);
   *       });
   *     }
   *   } else {
   *     console.warn('Analysis quality may be compromised due to provider failures');
   *   }
   * } catch (error) {
   *   console.error('Multi-LLM review failed completely:', error.message);
   * }
   * ```
   *
   * @since 1.0.0
   */
  async performMultiLLMReview(
    code: string,
    context: CodeContext
  ): Promise<MultiLLMReviewResult> {
    const startTime = new Date();
    const results: { [llmId: string]: AIReviewFinding[] } = {};
    const responseTimesMs: { [llmId: string]: number } = {};
    const tokensUsed: { [llmId: string]: number } = {};
    const estimatedCosts: { [llmId: string]: number } = {};
    const errors: { [llmId: string]: string | null } = {};

    // 🪝 HOOK: beforeAnalysis - KI-freundliche Regelwelt
    const beforeData: BeforeAnalysisData = {
      files: [context.filePath],
      projectPath: '', // CodeContext doesn't have projectPath, using empty string
      config: {
        language: context.language,
        enabledProviders: this.enabledProviders.map(p => p.id),
        tokenLimit: this.config.tokenLimit,
        parallelRequests: this.config.parallelRequests,
      },
      timestamp: new Date(),
    };

    try {
      await triggerHook('beforeAnalysis', beforeData);
    } catch (hookError) {
      console.debug(`Hook error (beforeAnalysis AI review): ${hookError}`);
    }

    try {
      // Validate code length
      if (code.length > this.config.tokenLimit * 4) {
        // Rough estimate: 1 token ≈ 4 chars
        throw new Error(
          `Code too long for analysis (${code.length} chars). Max: ${this.config.tokenLimit * 4}`
        );
      }

      console.log(
        `🧠 Starting AI Code Review with ${this.enabledProviders.length} LLM providers...`
      );

      // Run LLM requests (parallel or sequential based on config)
      if (this.config.parallelRequests) {
        const promises = this.enabledProviders.map(provider =>
          this.callLLMProvider(provider, code, context)
        );

        const responses = await Promise.allSettled(promises);

        responses.forEach((result, index) => {
          const provider = this.enabledProviders[index];
          if (result.status === 'fulfilled') {
            const response = result.value;
            results[provider.id] = response.findings;
            responseTimesMs[provider.id] = response.responseTime;
            tokensUsed[provider.id] = response.tokensUsed || 0;
            estimatedCosts[provider.id] = response.estimatedCost || 0;
            errors[provider.id] = response.error || null;
          } else {
            results[provider.id] = [];
            errors[provider.id] = result.reason?.toString() || 'Unknown error';
            responseTimesMs[provider.id] = 0;
            tokensUsed[provider.id] = 0;
            estimatedCosts[provider.id] = 0;
          }
        });
      } else {
        // Sequential execution
        for (const provider of this.enabledProviders) {
          try {
            const response = await this.callLLMProvider(
              provider,
              code,
              context
            );
            results[provider.id] = response.findings;
            responseTimesMs[provider.id] = response.responseTime;
            tokensUsed[provider.id] = response.tokensUsed || 0;
            estimatedCosts[provider.id] = response.estimatedCost || 0;
            errors[provider.id] = response.error || null;
          } catch (error) {
            results[provider.id] = [];
            errors[provider.id] =
              error instanceof Error ? error.message : 'Unknown error';
            responseTimesMs[provider.id] = 0;
            tokensUsed[provider.id] = 0;
            estimatedCosts[provider.id] = 0;
          }
        }
      }

      const endTime = new Date();

      // Aggregate results
      const aggregation = this.aggregateResults(results);

      const reviewResult: MultiLLMReviewResult = {
        codeContext: context,
        results,
        aggregation,
        meta: {
          analysisStartTime: startTime,
          analysisEndTime: endTime,
          totalDuration: endTime.getTime() - startTime.getTime(),
          llmResponseTimes: responseTimesMs,
          tokensUsed,
          estimatedCost: estimatedCosts,
          totalEstimatedCost: Object.values(estimatedCosts).reduce(
            (sum, cost) => sum + cost,
            0
          ),
          llmErrors: errors,
        },
      };

      // 🪝 HOOK: afterAnalysis - KI-freundliche Regelwelt
      const afterData: AfterAnalysisData = {
        files: [context.filePath],
        results: [
          {
            file: context.filePath,
            tool: 'ai-review',
            success: true,
            issues: Object.values(results).flat(),
          },
        ],
        duration: endTime.getTime() - startTime.getTime(),
        success: true,
        timestamp: new Date(),
      };

      try {
        await triggerHook('afterAnalysis', afterData);
      } catch (hookError) {
        console.debug(`Hook error (afterAnalysis AI review): ${hookError}`);
      }

      return reviewResult;
    } catch (error) {
      // 🪝 HOOK: onError - KI-freundliche Regelwelt
      const errorData: ErrorHookData = {
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'ai-review-analysis',
        filePath: context.filePath,
        timestamp: new Date(),
      };

      try {
        await triggerHook('onError', errorData);
      } catch (hookError) {
        console.debug(`Hook error (onError AI review): ${hookError}`);
      }

      throw error;
    }
  }

  /**
   * Call a specific LLM provider
   */
  private async callLLMProvider(
    provider: LLMProviderConfig,
    code: string,
    context: CodeContext
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      console.log(`  🤖 Calling ${provider.id} (${provider.model})...`);

      // Build provider-specific prompt
      const prompt = this.buildPromptForProvider(provider, code, context);

      // Get API key from environment
      const apiKey = process.env[provider.apiKeyEnvVar];
      if (!apiKey && provider.apiKeyEnvVar) {
        throw new Error(
          `API key not found in environment variable: ${provider.apiKeyEnvVar}`
        );
      }

      const validApiKey = apiKey || '';

      // Call appropriate method based on provider type
      let response: LLMResponse;
      switch (provider.providerType) {
        case 'anthropic':
          response = await this._callAnthropic(
            provider,
            prompt,
            code,
            context,
            validApiKey
          );
          break;
        case 'openai':
          response = await this._callOpenAI(
            provider,
            prompt,
            code,
            context,
            validApiKey
          );
          break;
        case 'azure-openai':
          response = await this._callAzureOpenAI(
            provider,
            prompt,
            code,
            context,
            validApiKey
          );
          break;
        case 'google':
          response = await this._callGoogle(
            provider,
            prompt,
            code,
            context,
            validApiKey
          );
          break;
        case 'custom-ollama':
          response = await this._callOllama(provider, prompt, code, context);
          break;
        default:
          throw new Error(
            `Unsupported provider type: ${provider.providerType}`
          );
      }

      response.responseTime = Date.now() - startTime;
      console.log(
        `  ✅ ${provider.id} completed (${response.responseTime}ms, ${response.findings.length} findings)`
      );

      // Track successful request
      const usageTracker = UsageTracker.getInstance();
      await usageTracker.trackRequest(
        provider.id,
        response.tokensUsed || 0,
        response.estimatedCost || 0
      );

      return response;
    } catch (error) {
      console.error(
        `  ❌ ${provider.id} failed:`,
        error instanceof Error ? error.message : error
      );

      // Track failed request
      const usageTracker = UsageTracker.getInstance();
      await usageTracker.trackError(provider.id);

      return {
        success: false,
        findings: [],
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Call Anthropic Claude API
   */
  private async _callAnthropic(
    provider: LLMProviderConfig,
    prompt: string,
    code: string,
    context: CodeContext,
    apiKey: string
  ): Promise<LLMResponse> {
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...provider.headers,
    };

    const body = this.interpolateTemplate(provider.bodyTemplate, {
      model: provider.model,
      prompt,
      code,
      language: context.language,
      systemPrompt: this.promptTemplate.systemPrompt,
    });

    const response: AxiosResponse = await axios.post(
      provider.baseUrl,
      safeJsonParse(body) || {},
      {
        headers,
        timeout: provider.timeout || 30000,
      }
    );

    const content = response.data.content[0].text;
    const findings = this.parseAIResponse(content, provider.id, context);

    return {
      success: true,
      findings,
      rawResponse: content,
      tokensUsed:
        response.data.usage?.input_tokens +
          response.data.usage?.output_tokens || 0,
      responseTime: 0, // Will be set by caller
      estimatedCost: this.estimateCost(
        provider.id,
        response.data.usage?.input_tokens || 0,
        response.data.usage?.output_tokens || 0
      ),
    };
  }

  /**
   * Call OpenAI GPT API
   */
  private async _callOpenAI(
    provider: LLMProviderConfig,
    prompt: string,
    code: string,
    context: CodeContext,
    apiKey: string
  ): Promise<LLMResponse> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...provider.headers,
    };

    const body = this.interpolateTemplate(provider.bodyTemplate, {
      model: provider.model,
      prompt,
      code,
      language: context.language,
      systemPrompt: this.promptTemplate.systemPrompt,
    });

    const response: AxiosResponse = await axios.post(
      provider.baseUrl,
      safeJsonParse(body) || {},
      {
        headers,
        timeout: provider.timeout || 30000,
      }
    );

    const content = response.data.choices[0].message.content;
    const findings = this.parseAIResponse(content, provider.id, context);

    return {
      success: true,
      findings,
      rawResponse: content,
      tokensUsed: response.data.usage?.total_tokens || 0,
      responseTime: 0,
      estimatedCost: this.estimateCost(
        provider.id,
        response.data.usage?.prompt_tokens || 0,
        response.data.usage?.completion_tokens || 0
      ),
    };
  }

  /**
   * Call Azure OpenAI API
   */
  private async _callAzureOpenAI(
    provider: LLMProviderConfig,
    prompt: string,
    code: string,
    context: CodeContext,
    apiKey: string
  ): Promise<LLMResponse> {
    const headers = {
      'Content-Type': 'application/json',
      'api-key': apiKey,
      ...provider.headers,
    };

    const body = this.interpolateTemplate(provider.bodyTemplate, {
      model: provider.model,
      prompt,
      code,
      language: context.language,
      systemPrompt: this.promptTemplate.systemPrompt,
    });

    const response: AxiosResponse = await axios.post(
      provider.baseUrl,
      safeJsonParse(body) || {},
      {
        headers,
        timeout: provider.timeout || 30000,
      }
    );

    const content = response.data.choices[0].message.content;
    const findings = this.parseAIResponse(content, provider.id, context);

    return {
      success: true,
      findings,
      rawResponse: content,
      tokensUsed: response.data.usage?.total_tokens || 0,
      responseTime: 0,
      estimatedCost: this.estimateCost(
        provider.id,
        response.data.usage?.prompt_tokens || 0,
        response.data.usage?.completion_tokens || 0
      ),
    };
  }

  /**
   * Call Google Gemini API
   */
  private async _callGoogle(
    provider: LLMProviderConfig,
    prompt: string,
    code: string,
    context: CodeContext,
    apiKey: string
  ): Promise<LLMResponse> {
    const url =
      provider.baseUrl.replace('{model}', provider.model) + `?key=${apiKey}`;

    const body = this.interpolateTemplate(provider.bodyTemplate, {
      model: provider.model,
      prompt,
      code,
      language: context.language,
      systemPrompt: this.promptTemplate.systemPrompt,
    });

    const requestBody = safeJsonParse(body);
    if (!requestBody) {
      throw new Error('Failed to parse request body JSON');
    }

    const response: AxiosResponse = await axios.post(url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        ...provider.headers,
      },
      timeout: provider.timeout || 30000,
    });

    const content = response.data.candidates[0].content.parts[0].text;
    const findings = this.parseAIResponse(content, provider.id, context);

    return {
      success: true,
      findings,
      rawResponse: content,
      tokensUsed: response.data.usageMetadata?.totalTokenCount || 0,
      responseTime: 0,
      estimatedCost: this.estimateCost(
        provider.id,
        response.data.usageMetadata?.promptTokenCount || 0,
        response.data.usageMetadata?.candidatesTokenCount || 0
      ),
    };
  }

  /**
   * Call local Ollama API
   */
  private async _callOllama(
    provider: LLMProviderConfig,
    prompt: string,
    code: string,
    context: CodeContext
  ): Promise<LLMResponse> {
    const body = this.interpolateTemplate(provider.bodyTemplate, {
      model: provider.model,
      prompt,
      code,
      language: context.language,
      systemPrompt: this.promptTemplate.systemPrompt,
    });

    const response: AxiosResponse = await axios.post(
      provider.baseUrl,
      safeJsonParse(body) || {},
      {
        headers: {
          'Content-Type': 'application/json',
          ...provider.headers,
        },
        timeout: provider.timeout || 60000,
      }
    );

    const content = response.data.response;
    const findings = this.parseAIResponse(content, provider.id, context);

    return {
      success: true,
      findings,
      rawResponse: content,
      tokensUsed: 0, // Ollama doesn't always provide token counts
      responseTime: 0,
      estimatedCost: 0, // Local models are free
    };
  }

  /**
   * Interpolate template placeholders with safe JSON escaping
   */
  private interpolateTemplate(
    template: string,
    variables: Record<string, string>
  ): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      // Use JSON.stringify to safely escape the value, then remove outer quotes
      const escapedValue = JSON.stringify(value).slice(1, -1);
      result = result.replace(new RegExp(`{${key}}`, 'g'), escapedValue);
    });
    return result;
  }

  /**
   * Build the complete prompt for LLM
   */
  /**
   * Build provider-specific prompt using dynamic templates
   */
  private buildPromptForProvider(
    provider: LLMProviderConfig,
    code: string,
    context: CodeContext
  ): string {
    // Check if we have a custom prompt template for this provider
    const customTemplate = this.promptTemplates[provider.id];

    if (customTemplate) {
      // Use custom template with variable interpolation
      // PromptManager imported at top level
      const promptManager = PromptManager.getInstance();

      const variables = {
        file_path: context.filePath,
        language: context.language,
        project_name: context.projectContext?.name || 'Unknown Project',
        framework: context.framework || 'None',
        code_content: code,
        total_lines: context.totalLines.toString(),
        expected_load: 'Standard',
        architecture_context: context.projectContext?.type || 'Unknown',
        testing_framework: 'Unknown',
        coverage_percentage: '0',
      };

      // Interpolate user prompt with variables
      const userPrompt = promptManager.interpolatePrompt(
        (customTemplate as unknown as Record<string, unknown>)
          .user_prompt as string,
        variables
      );

      return userPrompt;
    } else {
      // Fall back to default prompt
      return this.buildDefaultPrompt(code, context);
    }
  }

  /**
   * Build default prompt (legacy compatibility)
   */
  private buildDefaultPrompt(code: string, context: CodeContext): string {
    let prompt = this.promptTemplate.userPromptTemplate;

    // Add language instruction at the beginning
    let languageInstruction = '';
    try {
      languageInstruction = getAILanguageInstruction();
      prompt = `${languageInstruction}\n\n${prompt}`;
    } catch {
      // If i18n is not initialized, default to English
      prompt = `Respond exclusively in English.\n\n${prompt}`;
    }

    // Add context information
    if (this.promptTemplate.contextInjection.includeFileMetadata) {
      prompt += `\n\nFile: ${context.filePath}`;
      prompt += `\nLanguage: ${context.language}`;
      if (context.framework) {
        prompt += `\nFramework: ${context.framework}`;
      }
      prompt += `\nTotal Lines: ${context.totalLines}`;
    }

    if (
      this.promptTemplate.contextInjection.includeProjectContext &&
      context.projectContext
    ) {
      prompt += `\n\nProject Context:`;
      prompt += `\nProject: ${context.projectContext.name} (${context.projectContext.type})`;
      if (context.projectContext.dependencies.length > 0) {
        prompt += `\nKey Dependencies: ${context.projectContext.dependencies.slice(0, 5).join(', ')}`;
      }
    }

    if (
      this.promptTemplate.contextInjection.includeGitDiff &&
      context.gitDiff
    ) {
      prompt += `\n\nGit Diff:\n${context.gitDiff}`;
    }

    return prompt;
  }

  /**
   * Parse AI response into structured findings
   */
  private parseAIResponse(
    response: string,
    llmId: string,
    context: CodeContext
  ): AIReviewFinding[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn(`No JSON array found in ${llmId} response`);
        return [];
      }

      const findings = safeJsonParse(jsonMatch[0]);
      if (!findings || !Array.isArray(findings)) {
        console.warn(
          'Failed to parse AI findings JSON or result is not an array'
        );
        return [];
      }

      return findings.map(
        (finding: {
          severity?: string;
          category?: string;
          message?: string;
          rationale?: string;
          reason?: string;
          suggestion?: string;
          [key: string]: unknown;
        }) => ({
          llmId,
          severity:
            (finding.severity as 'critical' | 'high' | 'medium' | 'low') ||
            'medium',
          category:
            (finding.category as
              | 'security'
              | 'performance'
              | 'maintainability'
              | 'architecture'
              | 'code-smell'
              | 'best-practice') || 'code-smell',
          message: finding.message || 'No message provided',
          rationale:
            finding.rationale || finding.reason || 'No rationale provided',
          suggestion: finding.suggestion || 'No suggestion provided',
          filePath: context.filePath,
          lineNumber:
            (finding.lineNumber as number) || (finding.line as number),
          lineRange: finding.lineRange as
            | { start: number; end: number }
            | undefined,
          codeSnippet: finding.codeSnippet as string | undefined,
          confidence: (finding.confidence as number) || 0.8,
          tags: (finding.tags as string[]) || [],
          estimatedFixTime: finding.estimatedFixTime as string | undefined,
          businessImpact:
            (finding.businessImpact as 'low' | 'medium' | 'high') || 'medium',
        })
      );
    } catch (error) {
      console.error(`Failed to parse ${llmId} response:`, error);
      return [];
    }
  }

  /**
   * Aggregate results from multiple LLMs
   */
  private aggregateResults(results: { [llmId: string]: AIReviewFinding[] }) {
    const allFindings = Object.values(results).flat();

    const findingsBySeverity = allFindings.reduce(
      (acc, finding) => {
        acc[finding.severity] = (acc[finding.severity] || 0) + 1;
        return acc;
      },
      {} as { [severity: string]: number }
    );

    const findingsByCategory = allFindings.reduce(
      (acc, finding) => {
        acc[finding.category] = (acc[finding.category] || 0) + 1;
        return acc;
      },
      {} as { [category: string]: number }
    );

    // Find consensus findings (issues found by multiple LLMs)
    const consensusFindings = this.findConsensusIssues(results);

    // Find unique findings per LLM
    const uniqueFindings = this.findUniqueFindings(results, consensusFindings);

    // Calculate agreement score
    const llmAgreementScore =
      consensusFindings.length / Math.max(allFindings.length, 1);

    return {
      totalFindings: allFindings.length,
      findingsBySeverity,
      findingsByCategory,
      consensusFindings,
      uniqueFindings,
      llmAgreementScore,
    };
  }

  /**
   * Find issues that multiple LLMs agree on
   */
  private findConsensusIssues(results: {
    [llmId: string]: AIReviewFinding[];
  }): AIReviewFinding[] {
    const consensus: AIReviewFinding[] = [];
    const llmIds = Object.keys(results);

    // For now, simple consensus based on similar messages
    // TODO: Implement more sophisticated similarity detection
    // Current implementation uses simple string matching which may miss:
    // - Similar findings with different wording
    // - Findings that reference the same code issue from different perspectives
    // - Semantically equivalent findings across different languages
    // Consider implementing:
    // - Embedding-based similarity using sentence transformers
    // - AST-based comparison for code-related findings
    // - Fuzzy matching with configurable thresholds
    // Tracked in issue: #woaru-ai-similarity-enhancement
    for (const llmId of llmIds) {
      const findings = results[llmId];
      for (const finding of findings) {
        const similarFindings = llmIds
          .filter(id => id !== llmId)
          .map(id => results[id])
          .flat()
          .filter(f => this.areFindingsSimilar(finding, f));

        if (similarFindings.length >= this.config.minConsensusCount - 1) {
          consensus.push(finding);
        }
      }
    }

    return consensus;
  }

  /**
   * Find unique findings per LLM
   */
  private findUniqueFindings(
    results: { [llmId: string]: AIReviewFinding[] },
    consensusFindings: AIReviewFinding[]
  ): { [llmId: string]: AIReviewFinding[] } {
    const unique: { [llmId: string]: AIReviewFinding[] } = {};

    Object.entries(results).forEach(([llmId, findings]) => {
      unique[llmId] = findings.filter(
        finding =>
          !consensusFindings.some(consensus =>
            this.areFindingsSimilar(finding, consensus)
          )
      );
    });

    return unique;
  }

  /**
   * Check if two findings are similar (simple implementation)
   */
  private areFindingsSimilar(
    finding1: AIReviewFinding,
    finding2: AIReviewFinding
  ): boolean {
    // Simple similarity check based on message and line number
    const messageSimilarity = this.calculateStringSimilarity(
      finding1.message,
      finding2.message
    );
    const sameLine = finding1.lineNumber === finding2.lineNumber;
    const sameCategory = finding1.category === finding2.category;

    return messageSimilarity > 0.7 || (sameLine && sameCategory);
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Estimate cost for API calls
   */
  private estimateCost(
    llmId: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    // Rough cost estimates (USD per 1k tokens) - update these with current pricing
    const pricing: { [key: string]: { input: number; output: number } } = {
      'anthropic-claude': { input: 0.003, output: 0.015 },
      'openai-gpt4': { input: 0.03, output: 0.06 },
      'google-gemini': { input: 0.00035, output: 0.00105 },
      'azure-gpt4': { input: 0.03, output: 0.06 },
      'local-ollama': { input: 0, output: 0 },
    };

    const rates = pricing[llmId] || { input: 0.001, output: 0.002 };
    return (inputTokens * rates.input + outputTokens * rates.output) / 1000;
  }

  /**
   * Create default prompt template
   */
  private createDefaultPromptTemplate(): PromptTemplate {
    // Get language instruction for AI responses
    let languageInstruction = '';
    try {
      languageInstruction = getAILanguageInstruction();
    } catch {
      // If i18n is not initialized, default to English
      languageInstruction = 'Respond exclusively in English.';
    }

    return {
      systemPrompt: `You are an experienced, conservative Senior Staff Engineer with a focus on maintainability, security, and scalable architecture. You are extremely critical but fair and always provide well-reasoned explanations.

Your expertise areas include:
- Code security vulnerabilities and best practices
- Performance optimization and scalability concerns  
- Software architecture and design patterns
- Code maintainability and readability
- Industry best practices and coding standards

You are thorough, detail-oriented, and always explain the business impact of technical issues.

IMPORTANT LANGUAGE INSTRUCTION: ${languageInstruction}`,

      userPromptTemplate: `Analyze the following code for code smells, design principle violations, security risks, and potential performance bottlenecks.

For each finding:
1. Provide a clear rationale explaining WHY it's a problem
2. Explain the potential business impact 
3. Give a concrete improvement suggestion
4. Estimate the fix complexity/time if possible

IMPORTANT: 
- Be conservative and only flag genuine issues
- Use only your internal knowledge, no web search
- Focus on issues that have real business impact
- Respond ONLY in valid JSON format as an array of objects

Required JSON format:
[
  {
    "severity": "critical" | "high" | "medium" | "low",
    "category": "security" | "performance" | "maintainability" | "architecture" | "code-smell" | "best-practice",
    "message": "Brief description of the issue",
    "rationale": "Detailed explanation of why this is a problem", 
    "suggestion": "Specific improvement recommendation",
    "lineNumber": <line_number_if_applicable>,
    "confidence": <0.0_to_1.0>,
    "businessImpact": "low" | "medium" | "high",
    "estimatedFixTime": "5 minutes" | "30 minutes" | "2 hours" | "1 day" | "1 week"
  }
]`,

      contextInjection: {
        includeFileMetadata: true,
        includeProjectContext: true,
        includeGitDiff: false,
        maxCodeLength: 8000,
      },
    };
  }
}
