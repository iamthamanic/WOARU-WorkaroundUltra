/**
 * Supervisor-Agent Chat Server — WOARU integration with supervisor-agent-lib
 *
 * Starts a minimal HTTP chat server using supervisor-agent-lib's LLM service.
 * Uses WOARU's AI config (~/.woaru) for provider and API keys.
 * Optional: install supervisor-agent-lib and express to use `woaru chat`.
 */

import type { Request, Response } from 'express';
import type { LLMProviderConfig as WoaruLLMConfig } from '../types/ai-review.js';
import type { AIReviewConfig } from '../types/ai-review.js';

const WOARU_SYSTEM_PROMPT = `You are WOARU's assistant — the "Tech Lead in a Box" for code quality and production readiness.
When the user asks for project analysis, code review, or production checks, suggest the exact WOARU commands:
- "woaru analyze" — full project analysis (quality, security, SOLID, production readiness)
- "woaru review git" — review changes since main branch
- "woaru review local" — review uncommitted changes
- "woaru helpers" — list active vs missing dev tools
Answer in the user's language. Be concise and actionable.`;

function mapWoaruProviderToSupervisorAgent(
  provider: WoaruLLMConfig,
  apiKey: string
): { provider: 'openai' | 'anthropic' | 'gemini' | 'custom'; apiKey: string; defaultModel?: string; baseUrl?: string } | null {
  if (!apiKey) return null;
  const model = provider.model || undefined;
  switch (provider.providerType) {
    case 'openai':
      return { provider: 'openai', apiKey, defaultModel: model };
    case 'anthropic':
      return { provider: 'anthropic', apiKey, defaultModel: model };
    case 'google':
      return { provider: 'gemini', apiKey, defaultModel: model };
    case 'custom-ollama':
    case 'azure-openai':
      return { provider: 'custom', apiKey, defaultModel: model, baseUrl: provider.baseUrl };
    default:
      return null;
  }
}

export interface SupervisorAgentChatServerOptions {
  port?: number;
  host?: string;
}

/**
 * Load WOARU AI config and start chat server using supervisor-agent-lib LLM.
 * Requires optionalDependencies: supervisor-agent-lib, express.
 */
export async function startSupervisorAgentChatServer(
  options: SupervisorAgentChatServerOptions = {}
): Promise<void> {
  const port = options.port ?? 3344;
  const host = options.host ?? '127.0.0.1';

  // Load WOARU env and AI config
  const { ConfigManager } = await import('../config/ConfigManager.js');
  const configManager = ConfigManager.getInstance();
  await configManager.loadEnvironmentVariables();

  const { ConfigLoader } = await import('../ai/ConfigLoader.js');
  const configLoader = ConfigLoader.getInstance();
  const aiConfig: AIReviewConfig | null = await configLoader.loadConfig();

  if (!aiConfig?.providers?.length) {
    console.error('No AI providers configured. Run "woaru ai setup" first.');
    process.exit(1);
  }

  const providers: Array<{ provider: 'openai' | 'anthropic' | 'gemini' | 'custom'; apiKey: string; defaultModel?: string; baseUrl?: string }> = [];
  for (const p of aiConfig.providers) {
    if (!p.enabled) continue;
    const apiKey = process.env[p.apiKeyEnvVar] ?? (await configManager.getApiKey(p.id));
    const mapped = mapWoaruProviderToSupervisorAgent(p, apiKey || '');
    if (mapped) providers.push(mapped);
  }

  if (providers.length === 0) {
    console.error('No enabled AI providers with valid API keys. Run "woaru ai setup".');
    process.exit(1);
  }

  let initLLMService: (deps: { config: typeof providers; logger: { info: (m: string) => void; error: (m: string) => void; warn: (m: string) => void; debug: (m: string) => void } }) => void;
  let LLMService: new () => { complete: (opts: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; temperature?: number; maxTokens?: number }) => Promise<{ content: string }> };
  let disposeLLMService: () => void;

  try {
    const supervisorAgent = await import('supervisor-agent-lib');
    initLLMService = supervisorAgent.initLLMService;
    LLMService = supervisorAgent.LLMService as typeof LLMService;
    disposeLLMService = supervisorAgent.disposeLLMService;
  } catch {
    console.error('supervisor-agent-lib not installed. Install optional dependencies: npm install supervisor-agent-lib express');
    process.exit(1);
  }

  const logger = {
    info: (m: string) => console.log('[supervisor-agent]', m),
    error: (m: string) => console.error('[supervisor-agent]', m),
    warn: (m: string) => console.warn('[supervisor-agent]', m),
    debug: (_m: string) => {},
  };

  try {
    initLLMService({ config: providers, logger });
  } catch (e) {
    console.error('LLM service already initialized or failed:', e);
    process.exit(1);
  }

  const express = await import('express');
  const app = express.default();
  app.use(express.json());

  const llm = new LLMService();
  const conversation: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  app.post('/chat', async (req: Request, res: Response) => {
    const userMessage = typeof req.body?.message === 'string' ? req.body.message : '';
    if (!userMessage) {
      res.status(400).json({ error: 'Missing "message" in body' });
      return;
    }
    conversation.push({ role: 'user', content: userMessage });
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: WOARU_SYSTEM_PROMPT },
      ...conversation.map(m => ({ role: m.role, content: m.content })),
    ];
    try {
      const response = await llm.complete({
        messages,
        temperature: 0.3,
        maxTokens: 2048,
      });
      const assistantContent = response?.content ?? '';
      conversation.push({ role: 'assistant', content: assistantContent });
      res.json({ message: assistantContent });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'woaru-supervisor-agent-chat' });
  });

  const server = app.listen(port, host, () => {
    console.log(`WOARU + Supervisor-Agent chat server: http://${host}:${port}`);
    console.log('  POST /chat  { "message": "..." }');
    console.log('  GET  /health');
  });

  const shutdown = () => {
    server.close();
    try {
      disposeLLMService();
    } catch {
      // ignore
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
