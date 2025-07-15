module.exports = {
  ai: {
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
        id: "deepseek-chat",
        providerType: "openai",
        apiKeyEnvVar: "DEEPSEEK_API_KEY",
        baseUrl: "https://api.deepseek.com/v1/chat/completions",
        model: "deepseek-chat",
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
        enabled: true
      }
    ],
    parallelRequests: true,
    consensusMode: false,
    minConsensusCount: 2,
    tokenLimit: 8000,
    costThreshold: 0.50
  }
};