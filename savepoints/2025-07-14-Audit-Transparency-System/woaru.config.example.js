/**
 * WOARU Multi-LLM AI Code Review Configuration
 * 
 * This file configures multiple LLM providers for AI-powered code review.
 * Copy this to woaru.config.js and set your API keys in environment variables.
 */

module.exports = {
  ai: {
    // Global AI settings
    parallelRequests: true,
    consensusMode: false, // Set to true to only report issues found by multiple LLMs
    minConsensusCount: 2,
    tokenLimit: 8000,
    costThreshold: 0.50, // Max $0.50 per analysis

    // LLM Provider configurations
    providers: [
      {
        id: "anthropic-claude",
        providerType: "anthropic",
        apiKeyEnvVar: "ANTHROPIC_API_KEY",
        baseUrl: "https://api.anthropic.com/v1/messages",
        model: "claude-3-5-sonnet-20241022",
        headers: {
          "anthropic-version": "2023-06-01"
        },
        bodyTemplate: JSON.stringify({
          model: "{model}",
          max_tokens: 4000,
          temperature: 0.1,
          messages: [
            {
              role: "user", 
              content: "{prompt}\n\nCode to analyze:\n```{language}\n{code}\n```"
            }
          ]
        }),
        timeout: 30000,
        maxTokens: 4000,
        temperature: 0.1,
        enabled: true
      },
      {
        id: "openai-gpt4",
        providerType: "openai",
        apiKeyEnvVar: "OPENAI_API_KEY",
        baseUrl: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4o",
        headers: {},
        bodyTemplate: JSON.stringify({
          model: "{model}",
          messages: [
            {
              role: "system",
              content: "{systemPrompt}"
            },
            {
              role: "user", 
              content: "{prompt}\n\nCode to analyze:\n```{language}\n{code}\n```"
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        }),
        timeout: 30000,
        maxTokens: 4000,
        temperature: 0.1,
        enabled: false // Enable when you have OpenAI API key
      },
      {
        id: "google-gemini",
        providerType: "google",
        apiKeyEnvVar: "GOOGLE_AI_API_KEY",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        model: "gemini-1.5-pro",
        headers: {},
        bodyTemplate: JSON.stringify({
          contents: [{
            parts: [{
              text: "{prompt}\n\nCode to analyze:\n```{language}\n{code}\n```"
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000
          }
        }),
        timeout: 30000,
        maxTokens: 4000,
        temperature: 0.1,
        enabled: false // Enable when you have Google AI API key
      },
      {
        id: "azure-gpt4",
        providerType: "azure-openai",
        apiKeyEnvVar: "AZURE_OPENAI_API_KEY",
        baseUrl: "https://your-resource.openai.azure.com/openai/deployments/gpt-4/chat/completions",
        model: "gpt-4",
        headers: {
          "api-version": "2024-02-15-preview"
        },
        bodyTemplate: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "{systemPrompt}"
            },
            {
              role: "user", 
              content: "{prompt}\n\nCode to analyze:\n```{language}\n{code}\n```"
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        }),
        timeout: 30000,
        maxTokens: 4000,
        temperature: 0.1,
        enabled: false // Enable when you have Azure OpenAI configured
      },
      {
        id: "local-ollama",
        providerType: "custom-ollama",
        apiKeyEnvVar: "", // No API key needed for local Ollama
        baseUrl: "http://localhost:11434/api/generate",
        model: "codellama:13b",
        headers: {},
        bodyTemplate: JSON.stringify({
          model: "{model}",
          prompt: "{prompt}\n\nCode to analyze:\n```{language}\n{code}\n```",
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 4000
          }
        }),
        timeout: 60000, // Local models might be slower
        maxTokens: 4000,
        temperature: 0.1,
        enabled: false // Enable if you have Ollama running locally
      }
    ]
  }
};