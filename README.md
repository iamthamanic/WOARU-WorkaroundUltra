# WAU (WorkaroundUltra) 🚀

**Universal Project Setup Autopilot** - Analyze and automatically configure development tools for ANY programming language.

WAU is an intelligent CLI tool that **scans your actual codebase**, detects issues, and automatically sets up the best development tools with **specific explanations** based on what it finds in your code.

## ⚡ **Just Published to NPM - Now with Supervisor Mode!**

```bash
# Try it now - no installation required:
npx @iamthamanic/wau analyze

# 🆕 NEW: Start intelligent supervisor mode
npx @iamthamanic/wau watch

# Perfect for Claude Code sessions:
# 1. Open any project in Claude
# 2. Type: npx @iamthamanic/wau watch  
# 3. WAU continuously monitors and gives real-time recommendations
```

## 🌍 Multi-Language Support

WAU supports **all major programming languages** with intelligent detection:
- **JavaScript/TypeScript** - Next.js, React, Vue, Angular, Node.js
- **Python** - Django, Flask, FastAPI, pytest (fixed mixed-project detection)
- **C#/.NET** - ASP.NET, Unity, Blazor, xUnit
- **Java** - Spring Boot, Maven, Gradle, JUnit, Checkstyle
- **Go** - Gin, Echo, Fiber, golangci-lint, testify
- **Rust** - Actix, Rocket, Tokio, Clippy, cargo-audit
- **PHP** - Laravel, Symfony, WordPress, Composer
- **Ruby** - Rails, Sinatra, RSpec, Bundler

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

### NPX (Recommended - No Installation Required):
```bash
# Use directly without installing:
npx @iamthamanic/wau analyze

# In Claude Code, you can also install globally:
npm install -g @iamthamanic/wau
wau analyze
```

### Manual Installation (Development):
```bash
# Clone and install globally
git clone https://github.com/iamthamanic/WAU-WorkaroundUltra.git
cd WAU-WorkaroundUltra
npm install
npm link

# Now use anywhere:
wau --help
```

## 📋 Commands

### `wau analyze`
Analyze any project and get recommendations.

```bash
# With NPX (no installation needed):
npx @iamthamanic/wau analyze                    # Current directory
npx @iamthamanic/wau analyze --path ./my-app    # Specific path
npx @iamthamanic/wau analyze --json             # JSON output for automation

# If installed globally:
wau analyze                    # Current directory
wau analyze --path ./my-app    # Specific path
wau analyze --json             # JSON output for automation
```

### `wau setup`
Automatically install and configure recommended tools.

```bash
# With NPX:
npx @iamthamanic/wau setup                      # Interactive setup
npx @iamthamanic/wau setup --dry-run           # Preview changes
npx @iamthamanic/wau setup --force             # Force even if tools exist
npx @iamthamanic/wau setup -y                  # Skip all prompts

# If installed globally:
wau setup                      # Interactive setup
wau setup --dry-run           # Preview changes
wau setup --force             # Force even if tools exist
wau setup -y                  # Skip all prompts
```

### `wau watch` ⭐ **NEW!**
Start the intelligent supervisor to continuously monitor your project.

```bash
# With NPX:
npx @iamthamanic/wau watch                    # Start watching current directory
npx @iamthamanic/wau watch --auto-setup       # Auto-install recommended tools
npx @iamthamanic/wau watch --dashboard        # Show live dashboard
npx @iamthamanic/wau watch --webhook <url>    # Send notifications to webhook

# If installed globally:
wau watch                      # Start watching current directory
wau watch --auto-setup         # Auto-install recommended tools
wau watch --dashboard          # Show live dashboard
```

### `wau status`
Show supervisor status and project health.

```bash
# With NPX:
npx @iamthamanic/wau status

# If installed globally:
wau status
```

### `wau recommendations`
Show current tool recommendations.

```bash
# With NPX:
npx @iamthamanic/wau recommendations
npx @iamthamanic/wau recommendations --json

# If installed globally:
wau recommendations
wau recommendations --json
```

### `wau stop`
Stop the running supervisor.

```bash
# With NPX:
npx @iamthamanic/wau stop

# If installed globally:
wau stop
```

### `wau update-db`
Update the tools database from GitHub.

```bash
# With NPX:
npx @iamthamanic/wau update-db

# If installed globally:
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

### Java Projects:
- **Checkstyle** - Code style enforcement
- **SpotBugs** - Static analysis for bug detection
- **JUnit** - Industry standard testing
- **JaCoCo** - Test coverage reporting
- **Maven Enforcer** - Dependency management

### Go Projects:
- **golangci-lint** - Comprehensive linting (40+ linters)
- **goimports** - Import management and formatting
- **testify** - Testing toolkit with assertions
- **gosec** - Security vulnerability scanning
- **govulncheck** - Dependency vulnerability detection

### Rust Projects:
- **Clippy** - Official Rust linter
- **rustfmt** - Official code formatter
- **cargo-audit** - Security vulnerability auditing
- **cargo-deny** - Dependency licensing and duplicates
- **cargo-tarpaulin** - Code coverage reporting

### And more for every language!

## 🔥 **NEW: Supervisor Mode**

WAU v2.0 introduces **Supervisor Mode** - an intelligent file watcher that continuously monitors your project and provides real-time recommendations.

### ⚡ **What the Supervisor Does:**

1. **Real-time File Watching** - Monitors changes to your codebase
2. **Intelligent Recommendations** - Suggests tools based on actual code patterns
3. **Health Score Tracking** - Monitors project quality metrics
4. **Auto-Setup Mode** - Automatically installs recommended tools
5. **Context-Aware Notifications** - Only shows relevant suggestions
6. **State Persistence** - Remembers your project between sessions

### 🎯 **Supervisor Workflow:**

```bash
# Start the supervisor
npx @iamthamanic/wau watch

# WAU continuously monitors:
# ✅ File changes (*.js, *.ts, *.py, *.rs, etc.)
# ✅ New dependencies added
# ✅ Configuration files
# ✅ Code quality patterns
# ✅ Missing tools

# Get real-time notifications like:
# 🔴 "Found console.log statements - ESLint recommended"
# 🟡 "Inconsistent formatting detected - Prettier suggested"
# 🔵 "New test files - Jest configuration recommended"
```

### 🎮 **Dashboard Mode:**

```bash
npx @iamthamanic/wau watch --dashboard
```

```
┌─ WAU Supervisor ────────────────────────────────┐
│ Project: my-app (TypeScript + React)            │
│ Health Score: 85/100 ▓▓▓▓▓▓▓▓░░                │
├─────────────────────────────────────────────────┤
│ 🔴 Critical: ESLint not configured              │
│ 🟡 High: 23 console.log statements found        │
│ 🟢 Good: Prettier is properly configured        │
├─────────────────────────────────────────────────┤
│ File Activity: ████░░░░ (42 changes/min)        │
│ Watching: 1,247 files | Ignored: 18,432         │
└─────────────────────────────────────────────────┘
```

### 🤖 **Auto-Setup Mode:**

```bash
# Automatically install recommended tools
npx @iamthamanic/wau watch --auto-setup

# WAU will:
# ✅ Detect missing tools
# ✅ Install them automatically
# ✅ Configure them properly
# ✅ Update your health score
```

### 📡 **Webhook Integration:**

```bash
# Send notifications to Slack, Discord, etc.
npx @iamthamanic/wau watch --webhook https://hooks.slack.com/...

# JSON payload:
{
  "type": "recommendations",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": [
    {
      "tool": "eslint",
      "priority": "high",
      "reason": "Found 15 console.log statements"
    }
  ]
}
```

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

### Java:
- 🔍 **Code Style**: Checkstyle violations, formatting inconsistencies
- 🐛 **Bug Detection**: SpotBugs static analysis findings
- 🧪 **Testing**: Missing unit tests, inefficient test patterns
- 🏗️ **Spring**: Non-optimal Spring Boot configurations

### Go:
- 📏 **Linting**: golangci-lint findings across 40+ linters
- 🔧 **Imports**: Unused imports, formatting issues
- 🛡️ **Security**: gosec vulnerability detection
- 🧪 **Testing**: Missing table-driven tests, assertion improvements

### Rust:
- 📎 **Clippy**: Performance and idiom suggestions
- 🔧 **Formatting**: rustfmt style violations
- 🛡️ **Security**: cargo-audit vulnerability alerts
- ⚡ **Async**: Tokio usage patterns, async/await optimization

## 🤖 Claude Code Integration

### Perfect for Claude Sessions:
```bash
# In any project directory in Claude:
npx @iamthamanic/wau analyze

# WAU will automatically:
# 1. Detect the language (JS/TS/Python/C#/etc.)
# 2. Scan your actual code for issues
# 3. Explain WHY each tool is recommended
# 4. Show exact file:line numbers for problems
```

### Auto-Setup with Evidence:
```bash
# See what WAU found:
npx @iamthamanic/wau analyze

# Let WAU fix everything it found:
npx @iamthamanic/wau setup -y
```

### JSON for Advanced Analysis:
```bash
# Get structured data for Claude to process:
npx @iamthamanic/wau analyze --json

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

WAU stays current automatically with **production-grade automation**:

### Live Tools Database:
- 📡 **Weekly Updates**: GitHub Actions automatically update the tools database
- 📊 **Popularity Tracking**: NPM downloads, GitHub stars, deprecation detection
- 🔄 **Tool Evolution**: Automatically suggests Biome over ESLint+Prettier when it becomes popular
- ⚠️ **Deprecation Alerts**: Warns about outdated tools (tslint → eslint, moment → date-fns)

### Production CI/CD:
- 🧪 **Automated Testing**: Tests run on Node 16/18/20 for every change
- 🚀 **Auto-Publishing**: NPM releases triggered by GitHub releases
- 🔄 **Auto-PRs**: Weekly pull requests with tool database updates
- 📊 **Coverage Reports**: Comprehensive test coverage monitoring

### Community Driven:
- 🤝 **Community Contributions**: Tools database accepts PRs for new recommendations
- 📈 **Trending Detection**: Automatically discovers rising tools in the ecosystem
- 🎯 **Evidence-Based**: Recommendations based on actual usage statistics, not opinions
- 🌍 **Multi-Language**: Growing ecosystem of language-specific plugins

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

# Test coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### 🧪 Testing
WAU includes comprehensive tests covering:
- **Multi-language project detection** (JS/TS, Python, C#, Java, Go, Rust)
- **Code analysis engine** for all supported languages
- **Mixed-project handling** (e.g., Python projects with JS examples)
- **Framework detection** across all ecosystems
- **CI/CD integration** with GitHub Actions

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
2. **Universal Language Support**: 8 programming languages with intelligent detection
3. **Production-Grade**: Comprehensive testing, CI/CD, automated updates
4. **Claude-Optimized**: Built specifically for seamless Claude Code integration
5. **Smart Detection**: Handles mixed-language projects (e.g., Python + JS examples)
6. **Zero Configuration**: Just run `wau analyze` in any project directory
7. **Security Focus**: Vulnerability scanning for Go, Rust, Java, Python
8. **Framework-Aware**: Specific recommendations for Spring, Django, React, etc.

**WAU - Making project setup intelligent across ALL languages! 🌊**

---

**GitHub**: https://github.com/iamthamanic/WAU-WorkaroundUltra  
**Issues**: https://github.com/iamthamanic/WAU-WorkaroundUltra/issues