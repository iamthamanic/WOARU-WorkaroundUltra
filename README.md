# WAU (WorkaroundUltra) 🚀

**Universal Project Setup Autopilot** - Analyze and automatically configure development tools for ANY programming language.

WAU is an intelligent CLI tool that detects your project's language, frameworks, and automatically sets up the best development tools with proper configurations.

## 🌍 Multi-Language Support

WAU supports all major programming languages:
- **JavaScript/TypeScript** - Node.js, React, Next.js, Vue, Angular
- **Python** - Django, Flask, FastAPI, pytest
- **C#/.NET** - ASP.NET, Unity, Blazor
- **Java** - Spring, Spring Boot, JUnit
- **Go** - Gin, Echo, Fiber
- **Rust** - Actix, Rocket, Tokio
- **PHP** - Laravel, Symfony, WordPress
- **Ruby** - Rails, Sinatra, RSpec

## 🎯 Claude Code Integration

WAU is optimized for use in Claude Code sessions. Simply type `wau analyze` in any project!

### Direct Claude Usage:
```bash
# In Claude, just type:
wau analyze

# For specific path:
wau analyze --path /path/to/project

# Get JSON for Claude to process:
wau analyze --json
```

### Example Claude Workflow:
1. Open your project in Claude Code
2. Type: `wau analyze`
3. Claude sees the analysis and can help implement recommendations
4. Type: `wau setup -y` to auto-configure everything

## 🚀 Quick Start

### Installation:
```bash
# Clone and install globally
git clone https://github.com/yourusername/workaround-ultra.git
cd workaround-ultra
npm install
npm link

# Now use anywhere:
wau --help
```

### NPM Installation (coming soon):
```bash
npm install -g workaround-ultra
```

## 📋 Commands

### `wau analyze`
Analyze any project and get recommendations.

```bash
wau analyze                    # Current directory
wau analyze --path ./my-app    # Specific path
wau analyze --json             # JSON output for automation
```

### `wau setup`
Automatically install and configure recommended tools.

```bash
wau setup                      # Interactive setup
wau setup --dry-run           # Preview changes
wau setup --force             # Force even if tools exist
wau setup -y                  # Skip all prompts
```

### `wau update-db`
Update the tools database from GitHub.

```bash
wau update-db
```

## 🛠️ What WAU Can Setup

### JavaScript/TypeScript Projects:
- **ESLint** - with framework-specific configs
- **Prettier** - with Tailwind CSS plugin support
- **Husky + lint-staged** - Git hooks
- **Jest/Vitest** - Testing frameworks
- **TypeScript** - Strict mode configurations

### Python Projects:
- **Black** - The uncompromising formatter
- **Ruff** - Extremely fast linter
- **pytest** - Testing framework
- **mypy** - Static type checker
- **pre-commit** - Git hook framework
- **Poetry** - Dependency management

### C#/.NET Projects:
- **EditorConfig** - Code style consistency
- **dotnet-format** - Code formatter
- **xUnit** - Testing framework
- **SonarAnalyzer** - Code quality
- **Husky.Net** - Git hooks for .NET

### And more for every language!

## 📊 Example Output

```bash
$ wau analyze

🔍 Analyzing project...
📦 Project: my-todo-app (1.0.0)
🔧 Language: TypeScript
⚡ Frameworks: nextjs, react

📋 Analysis Results:

🔧 Setup Recommendations:
  • Install eslint for linting: Next.js has official ESLint configuration
  • Install prettier for formatting: Code formatting for consistent style
  • Install husky for git-hooks: Pre-commit hooks to ensure code quality

⚡ Framework-Specific Tools:
  • next-seo
  • @next/bundle-analyzer

🔄 Refactor Suggestions:
  • src/hooks/useTodos.ts: Use useCallback for event handlers
  • src/components/TodoItem.tsx: Consider using React.memo

✅ Already Installed:
  • typescript
  • tailwindcss

🤖 Claude Automation Ideas:
  • Generate TypeScript interfaces from API responses
  • Create unit tests for existing components
  • Setup Next.js middleware for authentication
```

## 🤖 Claude Code Best Practices

### 1. Start Every Project:
```bash
# First thing in any project:
wau analyze
```

### 2. Auto-Setup Development Environment:
```bash
# Let WAU configure everything:
wau setup -y
```

### 3. Get Detailed Analysis for Claude:
```bash
# Copy JSON to clipboard for Claude:
wau analyze --json | pbcopy  # macOS
wau analyze --json | xclip   # Linux
```

### 4. Use in CLAUDE.md:
Add to your project's CLAUDE.md file:
```markdown
## Project Setup
Run `wau analyze` to see project analysis and recommendations.
Run `wau setup -y` to auto-configure development tools.
```

## 🔧 Configuration

WAU uses a live tools database that updates automatically:
- Framework detection patterns
- Tool compatibility matrices
- Best-practice configurations
- Language-specific setups

## 🛡️ Safety Features

- **Automatic Backups** - All files backed up before changes
- **Dry Run Mode** - Preview changes before applying
- **Smart Detection** - Avoids duplicate configurations
- **Rollback Support** - Undo changes if needed

## 🔌 Plugin System

WAU is extensible with plugins for different languages and frameworks:

```typescript
// Create custom plugins
export class MyPlugin extends BasePlugin {
  name = 'MyFramework';
  
  canHandle(analysis: ProjectAnalysis): boolean {
    return analysis.framework.includes('myframework');
  }
  
  getRecommendations(analysis: ProjectAnalysis): SetupRecommendation[] {
    // Return tool recommendations
  }
}
```

## 📝 Development

```bash
# Clone repository
git clone https://github.com/yourusername/workaround-ultra.git
cd workaround-ultra

# Install dependencies
npm install

# Build
npm run build

# Test locally
npm link
wau --help

# Run tests
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Adding Language Support:
1. Create a plugin in `src/plugins/YourLanguagePlugin.ts`
2. Add language detection in `src/analyzer/LanguageDetector.ts`
3. Add tests and documentation
4. Submit PR

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built for seamless Claude Code integration
- Inspired by the need for universal project setup
- Community-driven tool recommendations

---

**WAU - Making project setup a breeze across ALL languages! 🌊**

For issues and feature requests: https://github.com/yourusername/workaround-ultra/issues