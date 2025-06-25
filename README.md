# WAU (WorkaroundUltra) 🚀

**Universal Project Setup Autopilot** - Analyze and automatically configure development tools for ANY programming language.

WAU is an intelligent CLI tool that **scans your actual codebase**, detects issues, and automatically sets up the best development tools with **specific explanations** based on what it finds in your code.

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
git clone https://github.com/iamthamanic/WAU-WorkaroundUltra.git
cd WAU-WorkaroundUltra
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

### TypeScript/Next.js Project:
```bash
$ wau analyze

🔍 Analyzing project...
📦 Project: my-todo-app (1.0.0)
🔧 Language: TypeScript
⚡ Frameworks: nextjs, react
🔬 Analyzing codebase for insights...

🔧 Setup Recommendations:
  • Install prettier for formatting: Inkonsistente Code-Formatierung gefunden. 
    Unterschiedliche Einrückungen und Stile in mehreren Dateien.
  • Install eslint for linting: Debug-Statements (console.log) im Code gefunden. 
    ESLint kann diese automatisch erkennen.

🔬 Code Analysis Insights:
  • PRETTIER: Inkonsistente Code-Formatierung gefunden.
    - src/pages/index.tsx:21: Trailing whitespace
    - Inkonsistente Einrückung: spaces-2, tabs
  • ESLINT: Debug-Statements (console.log) im Code gefunden.
    - src/components/TodoItem.tsx:15: console.log('rendering item')

✅ Already Installed:
  • typescript
  • tailwindcss
```

### Python Project:
```bash
$ wau analyze

🔍 Analyzing project...
📦 Project: raggadon (1.2.0)
🔧 Language: Python
⚡ Frameworks: django, pytest
🔬 Analyzing codebase for insights...

🔧 Setup Recommendations:
  • Install black for formatting: PEP8 Style-Verletzungen gefunden. 
    Black formatiert automatisch nach Python-Standards.
  • Install ruff for linting: Print-Statements im Code gefunden. 
    Ruff kann diese und andere Code-Smells erkennen.

🔬 Code Analysis Insights:
  • BLACK: PEP8 Style-Verletzungen gefunden.
    - main.py:13: Zeile zu lang (130 > 79)
    - views.py:5: Tabs statt Spaces
  • RUFF: Print-Statements im Code gefunden.
    - utils.py:22: print(f"Debug: {data}")
    - models.py:45: print("Processing...")

✅ Already Installed:
  • pytest
  • django
```

## 🔬 **NEW: Code Analysis Engine**

WAU doesn't just detect frameworks - it **scans your actual code** to find specific issues:

### JavaScript/TypeScript:
- 🔍 **Formatting Issues**: Finds inconsistent indentation, trailing whitespace
- 🐛 **Debug Statements**: Locates console.log, debugger statements with exact line numbers  
- 📏 **Code Complexity**: Detects functions with too many parameters or deep nesting
- ⚡ **Performance**: Missing React.memo, useCallback opportunities
- 🧪 **Testing**: Large codebases without test files

### Python:
- 📏 **PEP8 Violations**: Lines too long, tabs vs spaces, exact line numbers
- 🔍 **Type Hints**: Functions missing return type annotations
- 🐛 **Debug Prints**: print() statements in production code
- 🏗️ **Framework Patterns**: Django views that could use class-based patterns

### C#:
- ⚡ **Async Issues**: async void methods, .Result/.Wait() deadlock risks
- 📝 **Style**: Missing .editorconfig for team consistency
- 🏗️ **Architecture**: Controllers without dependency injection

## 🤖 Claude Code Integration

### Perfect for Claude Sessions:
```bash
# In any project directory in Claude:
wau analyze

# WAU will automatically:
# 1. Detect the language (JS/TS/Python/C#/etc.)
# 2. Scan your actual code for issues
# 3. Explain WHY each tool is recommended
# 4. Show exact file:line numbers for problems
```

### Auto-Setup with Evidence:
```bash
# See what WAU found:
wau analyze

# Let WAU fix everything it found:
wau setup -y
```

### JSON for Advanced Analysis:
```bash
# Get structured data for Claude to process:
wau analyze --json

# Includes code_insights with evidence:
{
  "code_insights": [
    {
      "tool": "prettier",
      "reason": "Inkonsistente Code-Formatierung gefunden...",
      "evidence": ["src/main.ts:15: Trailing whitespace"],
      "severity": "medium"
    }
  ]
}
```

## 🔄 **Auto-Updates & Future-Proof**

WAU stays current automatically:

### Live Tools Database:
- 📡 **Weekly Updates**: GitHub Actions automatically update the tools database
- 📊 **Popularity Tracking**: NPM downloads, GitHub stars, deprecation detection
- 🔄 **Tool Evolution**: Automatically suggests Biome over ESLint+Prettier when it becomes popular
- ⚠️ **Deprecation Alerts**: Warns about outdated tools (tslint → eslint, moment → date-fns)

### Community Driven:
- 🤝 **Community Contributions**: Tools database accepts PRs for new recommendations
- 📈 **Trending Detection**: Automatically discovers rising tools in the ecosystem
- 🎯 **Evidence-Based**: Recommendations based on actual usage statistics, not opinions

This means WAU **won't become outdated** - it evolves with the ecosystem!

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
git clone https://github.com/iamthamanic/WAU-WorkaroundUltra.git
cd WAU-WorkaroundUltra

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

## 🎯 **Use Cases**

### For Developers:
- 🚀 **New Project Setup**: Instant development environment with best practices
- 🔧 **Legacy Code**: Scan existing projects for improvement opportunities  
- 📊 **Code Review**: Get objective analysis before PR submission
- 🧹 **Technical Debt**: Identify and fix code quality issues systematically

### For Teams:
- 🤝 **Onboarding**: New team members get consistent development setup
- 📏 **Standards**: Enforce coding standards across all projects
- 🔄 **Modernization**: Keep projects updated with latest tooling
- 📈 **Quality Gates**: Automated quality checks in CI/CD

### For Claude Code Users:
- ⚡ **Instant Context**: WAU gives Claude immediate understanding of your codebase
- 🎯 **Targeted Suggestions**: Claude can focus on specific issues WAU found
- 🔧 **Automated Fixes**: Let WAU implement the tools Claude recommends
- 📋 **Structured Analysis**: JSON output perfect for Claude's processing

---

## 🌟 **What Makes WAU Special**

1. **Evidence-Based**: Never says "you should use X" without showing you WHY in your code
2. **Language Agnostic**: Works with any programming language, not just JavaScript
3. **Future-Proof**: Automatically stays current with ecosystem changes
4. **Claude-Optimized**: Built specifically for seamless Claude Code integration
5. **Zero Configuration**: Just run `wau analyze` in any project directory

**WAU - Making project setup intelligent across ALL languages! 🌊**

---

**GitHub**: https://github.com/iamthamanic/WAU-WorkaroundUltra  
**Issues**: https://github.com/iamthamanic/WAU-WorkaroundUltra/issues