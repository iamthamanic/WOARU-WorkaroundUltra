import { readFileSync } from 'fs';
import { join } from 'path';

// Read version from package.json dynamically
const packageJsonPath = join(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

export const APP_CONFIG = {
  // Application metadata
  NAME: 'woaru',
  DISPLAY_NAME: 'WOARU',
  VERSION: packageJson.version,
  DESCRIPTION: 'WorkaroundUltra - Project Setup Autopilot',
  
  // Directory structure
  DIRECTORIES: {
    BASE: '.woaru',
    REPORTS: '.woaru/reports',
    LOGS: '.woaru/logs',
    CACHE: '.woaru/cache',
    SAVEPOINTS: '.woaru/savepoints',
    SENT_REPORTS: '.woaru/sent-reports',
    HOME_BASE: '~/.woaru',
    HOME_LOGS: '~/.woaru/logs',
    HOME_CACHE: '~/.woaru/cache'
  },
  
  // File names
  FILES: {
    STATE: 'state.json',
    PID: 'supervisor.pid',
    ACTIONS_LOG: 'woaru_actions.log',
    TOOLS_CONFIG: 'tools.json',
    AI_MODELS: 'ai-models.json',
    IGNORE: '.woaruignore'
  },
  
  // GitHub URLs
  GITHUB: {
    REPO_URL: 'https://github.com/iamthamanic/WOARU-WorkaroundUltra',
    TOOLS_CONFIG_URL: 'https://raw.githubusercontent.com/iamthamanic/WOARU-WorkaroundUltra/main/tools.json',
    AI_MODELS_URL: 'https://raw.githubusercontent.com/iamthamanic/WOARU-WorkaroundUltra/main/ai-models.json'
  },
  
  // API endpoints
  API: {
    ANTHROPIC: 'https://api.anthropic.com/v1/messages',
    OPENAI: 'https://api.openai.com/v1/chat/completions',
    GOOGLE: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    OLLAMA: 'http://localhost:11434/api/generate',
    NPM_REGISTRY: 'https://registry.npmjs.org',
    GITHUB_API: 'https://api.github.com',
    PYPI: 'https://pypi.org/pypi/',
    NUGET: 'https://api.nuget.org/v3-flatcontainer/'
  },
  
  // AI model configurations
  AI_MODELS: {
    CLAUDE: {
      SONNET: 'claude-3-5-sonnet-20241022',
      HAIKU: 'claude-3-5-haiku-20241022',
      OPUS: 'claude-3-opus-20240229'
    },
    OPENAI: {
      GPT_4O: 'gpt-4o',
      GPT_4O_MINI: 'gpt-4o-mini',
      GPT_4_TURBO: 'gpt-4-turbo',
      GPT_3_5_TURBO: 'gpt-3.5-turbo'
    },
    GOOGLE: {
      GEMINI_PRO: 'gemini-1.5-pro',
      GEMINI_FLASH: 'gemini-1.5-flash'
    }
  },
  
  // Timeouts and thresholds
  TIMEOUTS: {
    DEFAULT: 30000, // 30 seconds
    AI_REQUEST: 30000,
    AUTO_SAVE: 30000,
    FILE_WATCHER_STABILITY: 300,
    FILE_WATCHER_POLL: 100
  },
  
  // Code quality thresholds
  QUALITY: {
    COMPLEXITY_THRESHOLD: 10,
    FUNCTION_LENGTH_THRESHOLD: 50,
    PARAMETER_COUNT_THRESHOLD: 5,
    NESTING_DEPTH_THRESHOLD: 4,
    
    // SOLID principle thresholds
    SOLID: {
      METHOD_COUNT: {
        LOW: 8,
        MEDIUM: 15,
        HIGH: 25
      },
      LINES_OF_CODE: {
        LOW: 15,
        MEDIUM: 30,
        HIGH: 50
      }
    }
  },
  
  // AI configuration limits
  AI_LIMITS: {
    MAX_TOKENS: 4000,
    TOKEN_LIMIT: 8000,
    COST_THRESHOLD: 0.50
  },
  
  // File watcher settings
  FILE_WATCHER: {
    DEPTH: 10,
    POLL_INTERVAL: 100,
    STABILITY_THRESHOLD: 300
  },
  
  // Common commands
  COMMANDS: {
    NPM: {
      INSTALL_GLOBAL: 'npm install -g',
      UPDATE_WOARU: 'npm install -g woaru@latest'
    },
    HUSKY: {
      INSTALL: 'npx husky install',
      PRE_COMMIT_ESLINT: 'eslint --fix',
      PRE_COMMIT_PRETTIER: 'prettier --write'
    },
    LINTING: {
      ESLINT: 'npx eslint',
      PRETTIER: 'npx prettier'
    }
  },
  
  // Package manager detection files
  PACKAGE_MANAGERS: {
    PNPM: 'pnpm-lock.yaml',
    YARN: 'yarn.lock',
    NPM: 'package-lock.json'
  }
};

export default APP_CONFIG;