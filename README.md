# WOARU 🚀
**WorkaroundUltra - Universal Project Setup Autopilot & Production-Readiness Agent**

The ultimate **"Tech Lead in a Box"** - Analyze, monitor, and automatically configure development tools for **ANY programming language** with real-time quality checks and production-readiness audits.

WOARU is an intelligent CLI tool that **scans your actual codebase**, detects issues, provides **live quality monitoring**, and ensures your project is **production-ready** with specific explanations based on what it finds in your code.

## ⚡ **Quick Start - Zero Installation Required**

```bash
# Check what tools you have active:
npx woaru helpers

# Analyze your project:
npx woaru analyze

# Start intelligent monitoring with live quality checks:
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

## 🎯 **Core Features**

### 🔍 **Phase 1: Live Quality Agent**
- **Real-time code quality monitoring** with file watchers
- **Instant feedback** on every file save with 🚨 critical warnings
- **Smart linting** that only checks what you're actually editing
- **Claude-optimized output** for seamless AI development

### 🌍 **Phase 2: Universal Language Support**
WOARU supports **8 major programming languages** with intelligent detection:

- **JavaScript/TypeScript** - ESLint with auto-fix suggestions
- **Python** - Ruff with automatic formatting 
- **Go** - gofmt + go vet integration
- **Rust** - rustfmt + clippy warnings
- **C#/.NET** - dotnet format compliance  
- **Java** - google-java-format + checkstyle
- **PHP** - PHP_CodeSniffer (PSR-12 standard)
- **Ruby** - RuboCop with auto-correct hints

### 🏗️ **Phase 3: Production-Readiness Auditor**
- **🔍 Error Monitoring Detection** - Sentry, Rollbar, Bugsnag
- **🧪 Testing Framework Audits** - Jest, Vitest, pytest, RSpec
- **🐳 Containerization Checks** - Dockerfile, .dockerignore
- **🔒 Security Validation** - Helmet.js, HTTPS enforcement, Snyk integration
- **⚙️ Configuration Management** - .env.example, secrets validation
- **📊 Priority-based recommendations** (Critical → High → Medium → Low)

### 🛡️ **NEW: Comprehensive Security Expert with Snyk Integration**
- **🚨 Critical Vulnerability Detection** - Real-time dependency scanning
- **🔒 Code Security Analysis** - Static analysis for security issues
- **⚡ Live Security Monitoring** - Proactive security alerts during development
- **📊 Security Health Score** - Quantified security posture measurement
- **🎯 Automated Security Recommendations** - Framework-specific security advice

## 🚨 **Live Quality Monitoring**

When you run `woaru watch`, WOARU becomes your **personal code quality guardian**:

```bash
🚨 CRITICAL QUALITY CHECK FAILED 🚨
File: src/components/UserProfile.tsx
Tool: ESLint
──────────────────────────────────────────────────
/src/components/UserProfile.tsx
  15:7   error  'userdata' is assigned a value but never used
  23:1   error  'console' is not defined
  45:10  error  'validateEmail' is defined but never used

✖ 3 problems (2 errors, 1 warning)
──────────────────────────────────────────────────
💡 Fix these issues before continuing development
Run the tool manually to see detailed output
```

## 🏗️ **Production-Readiness Audits**

WOARU automatically audits your project for production best practices:

```bash
🏗️ Production-Readiness-Audit:

🔴 CRITICAL - Muss behoben werden:
   ⚠️ WARNUNG: Kein Testing-Framework gefunden
     → Tests sind essentiell für Code-Qualität
     📦 jest, vitest, @testing-library/react

🟡 HIGH PRIORITY - Sollte behoben werden:
   💡 PRO-TIPP: Kein Error-Monitoring gefunden
     → Installiere Sentry für Production-Error-Tracking
     📦 @sentry/react

🔵 MEDIUM - Verbesserung empfohlen:
   🐳 Kein Dockerfile gefunden
     → Containerisierung vereinfacht Deployment
```

## 🎪 **Framework Intelligence**

WOARU automatically detects your framework and provides **specific recommendations**:

- **Next.js** - Suggests @sentry/nextjs, next/eslint, proper production configs
- **React** - Recommends @testing-library/react, React-specific ESLint rules
- **Express** - Suggests helmet.js, morgan logging, compression middleware
- **Django** - Recommends django-environ, pytest-django, gunicorn setup
- **Spring Boot** - Suggests actuator endpoints, logback configuration

## 📋 **Available Commands**

### Core Commands
```bash
woaru analyze        # Deep project analysis with security audit (★ NEW!)
woaru setup          # Auto-setup recommended tools
woaru helpers        # Show active vs missing tools (★ most useful)
woaru watch          # Start live quality monitoring with security (★ supervisor mode)
woaru review         # Code review: analyze only changed files with security (★ NEW SUB-COMMANDS!)
woaru commands       # Show detailed command reference (★ NEW!)
```

### Status and Management
```bash
woaru status         # Show supervisor status
woaru recommendations # Show current recommendations
woaru stop           # Stop supervisor
woaru update-db      # Update tools database
woaru logs           # Show supervisor logs
```

### Utility Commands
```bash
woaru ignore <tool>  # Ignore specific tools
woaru rollback <tool> # Rollback tool configurations
```

## 🔍 **NEW: Revolutionary Review Sub-Commands (v3.2.0)**

The `woaru review` command now features **three specialized sub-commands** for maximum flexibility and precision in code analysis:

### 🎯 **Three Powerful Review Modes**

#### 1. **Git Diff Reviews** - Perfect for Pull Requests
```bash
# Analyze changes since main branch
woaru review git

# Compare against different branch  
woaru review git --branch develop

# Generate JSON report for CI/CD
woaru review git --json

# Custom output file
woaru review git --output pr-review.md
```

#### 2. **Local Changes** - Pre-commit Quality Gates
```bash
# Analyze all uncommitted changes (staged + unstaged)
woaru review local

# Perfect before git commit
woaru review local --json
```

#### 3. **Path-Specific Analysis** - Deep-dive into Components
```bash
# Analyze specific directory
woaru review path src/components

# Analyze single file
woaru review path src/api/users.ts

# Multi-file analysis
woaru review path "src/**/*.tsx"
```

### 🚀 **Why Sub-Commands are Game-Changing**
- **🎯 Ultra-Precise**: Each mode targets exactly what you need to review
- **⚡ Lightning Fast**: No wasted analysis on irrelevant files  
- **🔄 CI-Ready**: Different modes for different automation scenarios
- **👥 Team-Friendly**: Clear intent makes collaboration seamless

### Real Example Output
```bash
🔍 Analyzing changes since branch: main
📋 Found 3 changed files:
   • src/components/UserProfile.tsx
   • package.json
   • src/api/users.ts

🔍 Running quality checks on changed files...

✅ Review report generated: woaru-review.md
📊 ⚠️ Gefunden: 2 Qualitäts-Probleme, 1 Produktions-Empfehlungen
```

### Sample Review Report (woaru-review.md)
```markdown
# WOARU Code Review
**Änderungen seit Branch: `main`**

## 🚨 Kritische Qualitäts-Probleme

### `src/components/UserProfile.tsx`
**ESLint:**
- Zeile 23: 'userData' is assigned a value but never used
- Zeile 45: Missing dependency in useEffect hook

## 🟡 Empfehlungen zur Produktionsreife

### `package.json`
**Du hast `react-spring` hinzugefügt**
→ Kein Error-Monitoring konfiguriert. Erwäge @sentry/react für Production-Apps
📦 `@sentry/react`
```

### Why `woaru review` is Game-Changing
- ⚡ **10x Faster**: Only checks changed files, not entire project
- 🎯 **Focused**: Relevant feedback for current work
- 🔄 **CI-Ready**: Perfect for automated Pull Request checks
- 📊 **Actionable**: Specific recommendations with package names
- 🤝 **Team-Friendly**: Consistent review standards across the team

## 📚 **NEW: Self-Documenting Commands Reference**

Never forget what WOARU can do! The new `woaru commands` provides **comprehensive documentation** for every command:

```bash
# Show complete command reference
woaru commands
```

### ✨ **Rich Command Documentation**
```bash
📚 WOARU Command Reference
══════════════════════════════════════════════════

🔍 woaru analyze
  Description: Comprehensive project analysis including security audit
  Usage: woaru analyze [options]
  Purpose: Performs a full analysis of your project including code quality, 
          security vulnerabilities, production readiness, and tool recommendations. 
          Perfect for understanding the overall health of your codebase.

🔄 woaru review <subcommand>
  Description: Code review and analysis tools
  Usage: woaru review <git|local|path> [options]
  Purpose: Focused analysis tools for code reviews. Choose from git diff 
          analysis, uncommitted changes review, or specific file/directory analysis.
  Subcommands:
    • woaru review git
      Purpose: Analyzes changes between your current branch and a base branch...
    • woaru review local  
      Purpose: Reviews your uncommitted changes before you commit them...
    • woaru review path
      Purpose: Focused analysis of specific files or directories...
```

### 🎯 **Perfect for Teams & Onboarding**
- **📖 Complete Reference**: Every command, option, and use case documented
- **🎓 Learning Tool**: New team members can explore WOARU's capabilities
- **🔍 Quick Lookup**: Find the right command for any situation
- **💡 Usage Examples**: Real-world scenarios for each command

## 🛠️ **Evidence-Based Recommendations**

Unlike other tools that guess, WOARU **scans your actual code** and provides evidence:

```bash
ESLint recommended because:
  → 12 console.log statements found in src/
  → 3 unused variables detected
  → Inconsistent formatting in 8 files
  
Prettier recommended because:  
  → Mixed quote styles detected
  → Inconsistent indentation found
  
Jest recommended because:
  → No test files found
  → React components without tests: 5
```

## 🚀 **Perfect for AI Development**

WOARU is specifically optimized for **Claude Code** and AI-assisted development:

- **Structured JSON output** for AI consumption
- **Clear terminal feedback** that AI can read and act on
- **Immediate context** - AI knows exactly what tools are active
- **Real-time problem detection** - AI gets instant feedback on code quality

## 📦 **Zero Configuration**

WOARU works **out of the box** with intelligent defaults:

- **Auto-detects** your language, framework, and dependencies
- **Respects existing configs** - won't override your settings
- **Safe by default** - creates backups before making changes
- **Incremental setup** - install only what you need

## 🔄 **Smart File Watching**

The supervisor mode intelligently monitors your project:

- **Ignores** node_modules, .git, dist automatically
- **Batches changes** to avoid spam during bulk operations
- **Framework-aware** - understands Next.js, Create React App structures
- **Performance optimized** - minimal CPU usage

## 🎯 **Use Cases**

### For Developers
- **Instant project setup** for new repositories
- **Code quality enforcement** during development
- **Production readiness validation** before deployment

### For Teams
- **Standardized tooling** across all projects
- **Automated onboarding** for new team members
- **Consistent quality gates** in CI/CD pipelines

### For AI-Assisted Development
- **Immediate project context** for Claude Code sessions
- **Real-time feedback loop** between AI and quality tools
- **Structured recommendations** that AI can act upon

## 🏆 **Why WOARU?**

**WOARU is the only tool that combines:**
- ✅ **Universal language support** (8+ languages)
- ✅ **Live quality monitoring** with real-time feedback
- ✅ **Production-readiness auditing** 
- ✅ **Evidence-based recommendations**
- ✅ **AI-optimized output**
- ✅ **Zero configuration setup**

**From setup to deployment - WOARU has you covered.** 🚀

## 📚 **Documentation**

- [Getting Started Guide](docs/getting-started.md)
- [Configuration Options](docs/configuration.md)
- [Supported Tools Database](docs/tools.md)
- [API Reference](docs/api.md)
- [Contributing](CONTRIBUTING.md)

## 🤝 **Contributing**

WOARU is **community-driven**. Help us expand language support and tool recommendations:

1. Fork the repository
2. Add new tools to `src/database/tools.json`
3. Create language-specific plugins in `src/plugins/`
4. Submit a pull request

## 📄 **License**

MIT License - Use freely in commercial and open-source projects.

---

**WOARU v3.2.0** - Your Universal Development Companion 🚀

## 🆕 **What's New in v3.2.0**
- 🔄 **MAJOR: Review Sub-Commands** - `woaru review git|local|path` for ultra-precise analysis
- 📚 **NEW: Self-Documenting Commands** - `woaru commands` shows complete reference
- 🎯 **Ultra-Focused Reviews** - Analyze exactly what you need: git diffs, local changes, or specific paths
- ⚡ **Modular Architecture** - Shared analysis engine for consistent results across all review modes
- 🚀 **Enhanced UX** - Intuitive command structure with clear intent and rich help text
- 🛠️ **Team-Friendly** - Perfect command separation for different workflows and CI/CD scenarios

### 🏆 **Previous Updates (v3.1.0)**
- 🔍 **NEW: `woaru review` Command** - Focused code review analysis for changed files only
- ⚡ **10x Faster Reviews** - Only analyze what you've actually changed
- 🎯 **CI/CD Integration** - JSON output perfect for automated Pull Request checks
- 🚀 **Async Performance** - Non-blocking supervisor startup for large projects
- 🛡️ **Enhanced Ignore Lists** - Better Python venv and build directory filtering

## 🛡️ **MAJOR: Comprehensive Security Expert Integration**

### 🚨 **Snyk Security Integration Across All Commands**

WOARU ist jetzt ein **vollwertiger Security-Experte** mit Snyk-Integration in allen drei Kernfunktionen:

#### **Phase 1: Security-Reviewer (`woaru review`)**
```bash
🔒 Running security analysis with Snyk...
🚨 SECURITY ALERT: Found 2 critical and 5 high severity vulnerabilities!

# Detaillierte Sicherheitsberichte in Markdown-Review-Reports
## 🚨 KRITISCHE SICHERHEITS-PROBLEME (gefunden von Snyk)
- 🔴 SQL Injection in express-validator@6.14.0
- 🔴 Prototype Pollution in lodash@4.17.20
```

#### **Phase 2: Live-Security-Wächter (`woaru watch`)**
```bash
📦 package.json wurde verändert - führe Sicherheitsanalyse durch...
🚨 SECURITY ALERT: 1 kritische Sicherheitslücke in neuer Dependency gefunden!
🔴 Kritische Schwachstelle in newly-added-package@1.0.0
```

#### **Phase 3: Security-Audit-Analyst (`woaru analyze`)**
```bash
🔒 SECURITY ANALYSIS
────────────────────────────────────────
Security Health Score: 75/100
🚨 Total Issues: 7
   ├─ Critical: 2
   ├─ High: 3
   ├─ Medium: 2
   └─ Low: 0
```

### 🎯 **Security Features**
- **🔍 Dependency Vulnerability Scanning** - Erkennt kritische Sicherheitslücken
- **💻 Code Security Analysis** - Statische Analyse für Sicherheitsprobleme
- **⚡ Live Background Scanning** - Proaktive Überwachung bei package.json-Änderungen
- **📊 Security Health Score** - Quantifizierte Sicherheitsbewertung (0-100)
- **🎯 Severity-basierte Priorisierung** - Critical → High → Medium → Low
- **📋 Actionable Recommendations** - Konkrete Fix-Anleitungen mit npm/snyk-Befehlen

## 🔄 **MAJOR: Live Tools Database System (v3.1.0)**

### 🌍 **Zukunftssicher - Immer auf dem neuesten Stand**

WOARU ist jetzt mit einem **Live Tools Database System** ausgestattet, das sich automatisch mit den neuesten Ecosystem-Daten aktualisiert:

```bash
💡 WOARU tools database updated successfully
   📊 45 tools across 6 categories
   🆕 Version: 1.2.3 (2025-01-11T14:30:00Z)
```

### 🚀 **Automatische Aktualisierungen**
- **🕐 Wöchentliche Updates**: Jeden Sonntag um 6:00 UTC via GitHub Actions
- **📈 NPM Download-Statistiken**: Empfehlungen basierend auf echten Nutzungsdaten
- **⭐ GitHub Stars & Activity**: Berücksichtigung von Community-Popularität
- **⚠️ Deprecation Detection**: Automatische Warnungen bei veralteten Tools mit Nachfolger-Empfehlungen

### 🧠 **Intelligente Empfehlungen**
```bash
⚠️ WARNUNG: Das von dir genutzte Tool eslint-config-airbnb ist veraltet
→ Der empfohlene Nachfolger ist @typescript-eslint/eslint-plugin
→ Migration: npm install @typescript-eslint/eslint-plugin
```

### 🎯 **Smart Prioritization**
Tools werden jetzt intelligent priorisiert basierend auf:
- **Popularity Score** (Download-Zahlen + GitHub Stars)
- **Framework Compatibility** (React, Next.js, Vue, etc.)
- **Maintenance Status** (Letzte Commits, Open Issues)
- **Community Adoption** (Contributor Count)

### 📊 **Database Statistics**
- **45+ Tools** across 6 major categories
- **Weekly Download Data** from NPM Registry API
- **GitHub Activity Metrics** (Stars, Issues, Contributors)
- **Automatic Deprecation Tracking** with successor recommendations

### 🔧 **Technical Features**
- **Multi-Layer Caching**: Online → Cache → Local → Minimal fallbacks
- **Background Updates**: Non-blocking 24-hour update cycles
- **Version Comparison**: Semantic versioning with intelligent update detection
- **Type-Safe Integration**: Full TypeScript support with enriched Tool interface

Das Live Tools Database System macht WOARU zur **ersten wirklich zukunftssicheren** Development-Tool-Empfehlung - immer aktuell, immer relevant! 🎯