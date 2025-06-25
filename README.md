# WOARU 🚀
**WorkaroundUltra - Universal Project Setup Autopilot**

Analyze and automatically configure development tools for **ANY programming language**.

WOARU is an intelligent CLI tool that **scans your actual codebase**, detects issues, and automatically sets up the best development tools with **specific explanations** based on what it finds in your code.

## ⚡ **Quick Start - Zero Installation Required**

```bash
# Check what tools you have active:
npx woaru helpers

# Analyze your project:
npx woaru analyze

# Start intelligent monitoring:
npx woaru watch

# Perfect for Claude Code sessions:
# 1. Open any project in Claude
# 2. Type: npx woaru helpers  
# 3. See all active tools and missing recommendations
# 4. Type: npx woaru watch (for continuous monitoring)
```

## 🔧 **Or Install Globally for Clean Commands**

```bash
# Install once:
npm install -g woaru

# Then use anywhere:
woaru helpers
woaru analyze
woaru watch
woaru setup
```

## 🌍 Multi-Language Support

WOARU supports **all major programming languages** with intelligent detection:
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
git clone https://github.com/iamthamanic/WOARU-WorkaroundUltra.git
cd WOARU-WorkaroundUltra
npm install
npm link

# Now use anywhere:
wau --help
```

## 📋 Commands

### `woaru analyze`
Analyze any project and get recommendations.

```bash
woaru analyze                    # Current directory
woaru analyze --path ./my-app    # Specific path
woaru analyze --json             # JSON output for automation

# Or without install:
npx woaru analyze
```

### `woaru helpers` ⭐
Show all detected/activated development tools and helpers.

```bash
woaru helpers                    # Show all tools
woaru helpers --active           # Only active tools
woaru helpers --missing          # Only missing/recommended
woaru helpers --json             # JSON output

# Or without install:
npx woaru helpers
```

### `woaru watch` ⭐
Start the intelligent supervisor to continuously monitor your project.

```bash
woaru watch                      # Start watching current directory
woaru watch --auto-setup         # Auto-install recommended tools
woaru watch --dashboard          # Show live dashboard
woaru watch --webhook <url>      # Send notifications to webhook

# Or without install:
npx woaru watch
```

### `woaru setup`
Automatically install and configure recommended tools.

```bash
woaru setup                      # Interactive setup
woaru setup --dry-run           # Preview changes
woaru setup --force             # Force even if tools exist
woaru setup -y                  # Skip all prompts

# Or without install:
npx woaru setup
```

### `woaru status`
Show supervisor status and project health.

```bash
woaru status

# Or without install:
npx woaru status
```

### `woaru recommendations`
Show current tool recommendations.

```bash
woaru recommendations
woaru recommendations --json

# Or without install:
npx woaru recommendations
```

### `woaru stop`
Stop the running supervisor.

```bash
woaru stop

# Or without install:
npx woaru stop
```

### `woaru update-db`
Update the tools database from GitHub.

```bash
woaru update-db

# Or without install:
npx woaru update-db
```

## 🛠️ What WOARU Can Setup

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

## 🔥 **Supervisor Mode & Tool Inspector**

WOARU introduces **Supervisor Mode** and **Tool Inspector** - intelligent project monitoring and comprehensive tool visibility.

### 🔧 **Tool Inspector (`woaru helpers`):**

1. **Active Tool Detection** - Shows all currently installed/configured tools
2. **Missing Tool Recommendations** - Identifies gaps in your tooling setup
3. **Priority-Based Suggestions** - Critical → High → Medium → Low recommendations
4. **Category Breakdown** - Groups tools by type (linter, formatter, test, etc.)
5. **Coverage Metrics** - Shows percentage of recommended tools already active
6. **Flexible Filtering** - View only active tools, only missing, or get JSON output

### ⚡ **What the Supervisor Does:**

1. **Real-time File Watching** - Monitors changes to your codebase
2. **Intelligent Recommendations** - Suggests tools based on actual code patterns
3. **Health Score Tracking** - Monitors project quality metrics
4. **Auto-Setup Mode** - Automatically installs recommended tools
5. **Context-Aware Notifications** - Only shows relevant suggestions
6. **State Persistence** - Remembers your project between sessions

### 🎯 **Typical Workflow:**

```bash
# 1. Check current tool status
npx woaru helpers

# Output:
# ✅ Active Tools: eslint, prettier, typescript
# 🔧 Recommended: husky (git-hook), jest (test)
# 📈 Coverage: 60% (3 active, 2 recommended)

# 2. Install missing tools
npx woaru setup

# 3. Start continuous monitoring
npx woaru watch

# WOARU continuously monitors:
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

### `woaru helpers` Output:
```bash
$ npx woaru helpers

🔧 Development Tools for my-react-app
   Language: TypeScript | Health Score: 85/100

✅ Active Tools:
   ✓ eslint
   ✓ prettier
   ✓ typescript
   ✓ jest

🔧 Recommended Tools:
   🟡 husky (git-hook) - Git hooks not configured
   🔵 lint-staged (git-hook)
   ⚪ storybook (test)

📊 Tool Categories:
   linter: eslint
   formatter: prettier
   test: jest
   build: typescript

📈 Summary: 4 active, 3 recommended (57% coverage)
💡 Run "woaru setup" to install recommended tools
```

### TypeScript/Next.js Project:
```bash
$ woaru analyze

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
$ woaru analyze

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
npx woaru analyze

# WOARU will automatically:
# 1. Detect the language (JS/TS/Python/C#/etc.)
# 2. Scan your actual code for issues
# 3. Explain WHY each tool is recommended
# 4. Show exact file:line numbers for problems
```

### Auto-Setup with Evidence:
```bash
# See what WOARU found:
npx woaru analyze

# Let WOARU fix everything it found:
npx woaru setup -y
```

### JSON for Advanced Analysis:
```bash
# Get structured data for Claude to process:
npx woaru analyze --json

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
git clone https://github.com/iamthamanic/WOARU-WorkaroundUltra.git
cd WOARU-WorkaroundUltra

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
- 🔍 **Tool Discovery**: `woaru helpers` shows what's working vs what's missing

### For Teams:
- 🤝 **Onboarding**: New team members get consistent development setup
- 📏 **Standards**: Enforce coding standards across all projects
- 🔄 **Modernization**: Keep projects updated with latest tooling
- 📈 **Quality Gates**: Automated quality checks in CI/CD
- 👥 **Tool Audits**: Team-wide visibility into tool adoption and gaps

### For Claude Code Users:
- ⚡ **Instant Context**: WOARU gives Claude immediate understanding of your codebase
- 🎯 **Targeted Suggestions**: Claude can focus on specific issues WOARU found
- 🔧 **Automated Fixes**: Let WOARU implement the tools Claude recommends
- 📋 **Structured Analysis**: JSON output perfect for Claude's processing
- 🛠️ **Tool Status**: Quick `woaru helpers` check before asking Claude for help

---

## 🌟 **What Makes WOARU Special**

1. **Evidence-Based**: Never says "you should use X" without showing you WHY in your code
2. **Universal Language Support**: 8 programming languages with intelligent detection
3. **Production-Grade**: Comprehensive testing, CI/CD, automated updates
4. **Claude-Optimized**: Built specifically for seamless Claude Code integration
5. **Smart Detection**: Handles mixed-language projects (e.g., Python + JS examples)
6. **Zero Configuration**: Just run `woaru analyze` in any project directory
7. **Security Focus**: Vulnerability scanning for Go, Rust, Java, Python
8. **Framework-Aware**: Specific recommendations for Spring, Django, React, etc.
9. **🆕 Tool Visibility**: `woaru helpers` command shows all active/missing tools at a glance
10. **🆕 Real-time Monitoring**: Supervisor mode with intelligent file watching

**WOARU v3.0 - Making project setup intelligent across ALL languages! 🌊**

---

**GitHub**: https://github.com/iamthamanic/WOARU-WorkaroundUltra  
**Issues**: https://github.com/iamthamanic/WOARU-WorkaroundUltra/issues