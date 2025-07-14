# WOARU 🚀 v3.5.0
**WorkaroundUltra - Universal Project Setup Autopilot & Production-Readiness Agent**

The ultimate **"Tech Lead in a Box"** - Analyze, monitor, and automatically configure development tools for **ANY programming language** with real-time quality checks, SOLID architecture analysis, and production-readiness audits.

## 🆕 **Latest Release: v3.5.0 - MAJOR: Dynamic & Customizable AI Prompt Templates System**
**Release Date:** July 14, 2025

### 🎯 **REVOLUTIONARY: User-Controlled AI Analysis with Dynamic Prompts**
**Problem Solved:** Fixed AI analysis prompts meant one-size-fits-all reviews. Users couldn't customize analysis focus for security, performance, refactoring, or testing needs.

**Game-Changing Solution:**
- **🎨 5 Specialized Prompt Templates** - Choose your analysis focus:
  - `default_review` - Comprehensive code quality analysis
  - `security_audit` - Deep security vulnerability scanning  
  - `refactoring_suggestions` - Architecture and code improvement recommendations
  - `performance_optimization` - Performance bottleneck identification
  - `testing_strategy` - Test coverage and quality assessment
- **📝 YAML-Based Templates** - Human-readable, easily customizable prompt configuration
- **🔄 Dynamic Template Loading** - Switch analysis modes with simple `--prompt` flag
- **🎯 Provider-Specific Customization** - Optimize prompts for each LLM's strengths

### 🏗️ **MAJOR: Complete Prompt Management Architecture**
- **📚 Template Library** - Professional prompt templates in `templates/prompts/`
  - Each template includes system prompts, user prompts, parameters, and output formats
  - Variable interpolation for context-aware analysis
  - Structured YAML format for easy customization
- **🏠 User Customization** - Personal templates in `~/.woaru/config/woaru_llm_prompts/[provider]/`
  - Automatic template copying during `woaru setup llm`
  - Edit templates to match your team's standards
  - Provider-specific optimization capabilities
- **⚡ Seamless Integration** - Works with all LLM commands
  - `woaru analyze llm --prompt security_audit`
  - `woaru review git llm --prompt performance_optimization`
  - `woaru review local llm --prompt refactoring_suggestions`
  - `woaru review path llm --prompt testing_strategy`

### 🚀 **User Experience Revolution**
**Before (Limited & Inflexible):**
```
❌ Single generic prompt for all analyses
❌ No focus control for specific concerns
❌ Same analysis whether checking security or performance
```

**After (Dynamic & Powerful):**
```
✅ Choose specialized analysis focus with --prompt flag
✅ Security audits find vulnerabilities, not style issues
✅ Performance analysis targets bottlenecks, not formatting
✅ Customize prompts for your team's specific needs
```

### 🔧 **Technical Implementation**
- **🏗️ PromptManager Class** - `src/ai/PromptManager.ts` handles all prompt operations
  - Template loading and validation
  - Variable interpolation system
  - Provider-specific prompt management
  - Fallback mechanisms for stability
- **🔄 Enhanced AIReviewAgent** - Dynamic prompt injection per provider
  - Provider-specific template selection
  - Context-aware variable substitution
  - Backwards compatibility maintained
- **📋 Professional Templates** - 5 expert-crafted analysis templates
  - Comprehensive documentation and examples
  - Industry best practices embedded
  - Extensible structure for custom additions

### 🎉 **Impact & Benefits**
- **🎯 Targeted Analysis** - Get exactly the insights you need, when you need them
- **📈 Improved Accuracy** - Specialized prompts yield more relevant findings
- **🔧 Team Customization** - Adapt analysis to your coding standards
- **💡 Transparent AI** - See and control exactly what the AI is asked to analyze

### 📚 **Usage Examples**
```bash
# Security-focused analysis
woaru analyze llm --prompt security_audit

# Performance optimization review  
woaru review git llm --prompt performance_optimization

# Refactoring suggestions for specific files
woaru review path src/api --prompt refactoring_suggestions

# Test coverage analysis
woaru analyze llm --prompt testing_strategy

# List available prompts
ls ~/.woaru/config/woaru_llm_prompts/[provider]/
```

### 🛡️ **Available Prompt Templates**
1. **default_review.yaml** - Balanced code quality analysis
2. **security_audit.yaml** - OWASP-aligned security scanning
3. **performance_optimization.yaml** - Bottleneck and efficiency analysis
4. **refactoring_suggestions.yaml** - Clean code and pattern recommendations
5. **testing_strategy.yaml** - Coverage and test quality assessment

## 🔍 **Previous Release: v3.4.0 - MAJOR: Revolutionary Secure API Key Management System**
**Release Date:** July 14, 2025

### 🚀 **GAME-CHANGING: Complete Setup UX Revolution**
**Problem Solved:** Users were confused by the old setup dialog asking for "environment variable names" instead of actual API keys, leading to setup failures and frustration.

**Revolutionary Solution:**
- **🎯 Direct API Key Input** - Setup now asks directly: *"Bitte füge deinen OpenAI API-Key ein (beginnt mit 'sk-'):"*
- **🔐 Password-Masked Input** - API keys are hidden during typing for security
- **✅ Smart Validation** - Automatic format checking (sk- prefix, length validation)
- **⚡ Instant Availability** - Keys work immediately after setup, no shell restarts required

### 🛡️ **MAJOR: Revolutionary ConfigManager Architecture**
- **🏠 Global .env Management** - Secure API key storage in `~/.woaru/.env`
  - **600 File Permissions** - Owner-only read/write access for maximum security
  - **Automatic .gitignore Protection** - Prevents accidental commits to version control
  - **Cross-Session Persistence** - Keys survive system restarts and terminal sessions
- **🔄 Automatic Environment Loading** - dotenv integration loads keys on WOARU startup
  - **Zero Configuration** - No manual shell setup or environment variable management
  - **Silent Fallback** - Graceful handling when configuration is missing
  - **Universal Compatibility** - Works across all terminals, IDEs, and environments

### 🎯 **User Experience Transformation**
**Before (Confusing & Error-Prone):**
```
❓ "Environment variable name for API key:"
→ User types: "sk-proj-abc123..." (WRONG!)
→ Result: ❌ API key not found in all LLM commands
```

**After (Intuitive & Bulletproof):**
```
✨ "Bitte füge deinen OpenAI API-Key ein (beginnt mit 'sk-'):"
→ User types: "sk-proj-abc123..." (CORRECT!)
→ Result: ✅ API key stored securely! 🚀 Ready for immediate use!
```

### 🔧 **Technical Implementation**
- **🏗️ New ConfigManager Class** - `src/config/ConfigManager.ts` with enterprise-grade security
- **🔐 Secure Storage System** - Automatic directory creation and permission management
- **⚡ Race Condition Fixes** - Proper async/await initialization prevents startup errors
- **🛡️ Security by Default** - Multiple layers of protection against accidental exposure

### 🎉 **Impact & Benefits**
- **📈 Setup Success Rate** - Eliminates 100% of API key configuration confusion
- **🚀 Time to Productivity** - From minutes of troubleshooting to instant success
- **🛡️ Security Enhancement** - Professional-grade key management with automatic protection
- **💡 User Confidence** - Clear, intuitive interface builds trust and reduces support burden

## 🔍 **Previous Release: v3.3.1 - Production Polish & Legacy Cleanup**
**Release Date:** July 14, 2025

### 🔧 **Hotfix: Legacy References & Initialization**
- **🧹 Complete Legacy Cleanup** - Removed all outdated "WAU" references throughout codebase
  - Updated notifications, error messages, and user-facing text to "WOARU"
  - Fixed GitHub URLs pointing to old repository names
  - Consistent branding across all components
- **⚡ ConfigManager Initialization Fix** - Resolved race condition in environment loading
  - Proper async/await structure ensures configuration loads before commands
  - Eliminates "API key not found" issues on first startup
  - Guaranteed environment variable availability across all commands
- **🛡️ First-Time User Experience** - Enhanced startup behavior for new users
  - Automatic directory creation (`~/.woaru/`) on first run
  - Graceful handling of missing configuration files
  - Clear guidance for setup without crashes or confusion

## 🔍 **Previous Release: v3.3.0 - Secure API Key Management & Revolutionary Setup Experience**
**Release Date:** July 14, 2025

### 🔐 **MAJOR: Secure ConfigManager System**
- **🛡️ Global .env Management** - New `ConfigManager` class handles secure API key storage
  - API keys stored in `~/.woaru/.env` with 600 permissions (owner-only access)
  - Automatic gitignore protection to prevent accidental commits
  - Centralized configuration for all WOARU tools
- **🔄 Dotenv Integration** - Automatic environment variable loading on startup
  - No more manual shell configuration required
  - Keys instantly available across all WOARU commands
  - Silent fallback for missing configuration

### 🚀 **Completely Overhauled Setup Process**
- **💬 Intuitive User Interface** - Revolutionary setup dialog experience
  - Direct API key input: "Bitte füge deinen OpenAI API-Key ein"
  - Password-masked input for security during typing
  - Smart validation (checks for 'sk-' prefix for OpenAI/Anthropic)
  - Immediate feedback and helpful error messages
- **⚡ One-Click Configuration** - No more complex shell setup required
  - Keys stored securely and automatically
  - Ready to use immediately after setup
  - Cross-session persistence without manual configuration

### 🛡️ **Enhanced Security Features**
- **🔒 File Permissions** - Automatic 600 permissions on sensitive files
- **🚫 Git Protection** - Automatic gitignore entries for `.woaru/.env`
- **⚠️ Safety Warnings** - Alerts if no global gitignore is configured
- **🔐 Input Validation** - Comprehensive API key format checking

### 🐛 **Bulletproof Error Handling**
- **💪 Super-Robust UsageTracker** - Enhanced resilience against corrupted files
  - Empty file detection and handling
  - Invalid JSON recovery with automatic recreation
  - Size-based validation before parsing
  - Multiple fallback strategies
- **🔄 Graceful Degradation** - System continues working even with missing components

### 🔧 **Previous Features (v3.2.0):**
- **📦 Unified Version System** - Dynamic version loading from package.json
- **🔄 Update Command** - `woaru update` for easy updates
- **🏗️ Architecture Refactoring** - Centralized configuration system

### 🆕 **Enhanced Commands:**
```bash
# Secure, one-click LLM setup:
woaru setup llm

# Update WOARU to the latest version:
woaru update

# Check stored API keys:
ls ~/.woaru/.env  # (securely stored)
```

### 🎯 **User Experience Revolution:**
- **🔥 Zero-Configuration** - API keys work immediately after setup
- **🛡️ Security by Default** - Automatic protection against accidental commits
- **💡 Intuitive Interface** - Clear prompts and helpful guidance
- **⚡ Instant Availability** - No shell restarts or manual configuration required
- **🔄 Cross-Session Persistence** - Configuration survives system restarts

## 🔍 **Previous Release: v1.3.0 - Comprehensive Audit & Transparency System**
**Release Date:** July 14, 2025

### 🔍 **MAJOR: Complete Audit & Transparency System**
- **📋 Standardized Report Filenames** - All reports now use sortable timestamp format: `woaru_[command]_report_[YYYY]-[MM]-[DD]_[HH]-[MM]-[SS]_[TZ].md`
- **📊 Comprehensive Activity Logging** - Every WOARU action is tracked with timestamps, context, and performance metrics in `~/.woaru/logs/woaru_actions.log`
- **🔍 Advanced Log Management** - New `woaru logs` command with filtering, export, and analysis capabilities
- **🎯 Message System Enhancement** - `woaru message latest` now uses proper timestamp-based sorting for report delivery
- **⚡ Performance Tracking** - Memory usage, execution time, and success/failure metrics for all operations

### 🚀 **New Commands & Features:**
- **`woaru logs`** - View recent activity logs with filtering options
- **`woaru logs --tail 100`** - Show last 100 log entries
- **`woaru logs --project /path`** - Filter logs by project path
- **`woaru logs --action analyze`** - Filter logs by specific action type
- **`woaru logs --since 2024-01-01`** - Time-based log filtering
- **`woaru logs --export json`** - Export logs in JSON, CSV, or TXT format
- **`woaru logs clear`** - Clear all activity logs (with confirmation)
- **`woaru logs stats`** - Show log file statistics and active actions

### 🔧 **Technical Improvements:**
- **Standardized Filename Generation** - New `FilenameHelper` class for consistent report naming
- **Singleton Activity Logger** - Comprehensive tracking system with start/complete cycles
- **Enhanced Report Generator** - Automatic fallback to standardized filenames
- **Input Validation** - Comprehensive validation and error handling across all new systems
- **TypeScript Quality** - Full TSDoc documentation and type safety improvements

### 🛡️ **Audit & Transparency Features:**
- **Complete Action Tracking** - Every command execution is logged with context and performance data
- **Sortable Report History** - Chronological organization of all generated reports
- **Detailed Performance Metrics** - Memory usage, execution time, and success rates
- **Flexible Log Analysis** - Filter by time, project, action type, or export for external analysis
- **Secure Logging** - No sensitive data logged, only operational context and metrics

### 📊 **Previous Major Feature (v1.2.0):**
- **SOLID Principles Checking** - Complete SRP (Single Responsibility Principle) analysis for TypeScript/JavaScript
- **Architecture Scoring** - 0-100 SOLID score with severity-weighted violations
- **Smart Detection** - Method count, complexity, concern diversity, class size, parameter analysis
- **Seamless Integration** - Automatic SOLID checks during `woaru review` commands
- **Detailed Reporting** - Location-specific violations with explanations and solutions

WOARU is an intelligent CLI tool that **scans your actual codebase**, detects issues, provides **live quality monitoring**, checks **SOLID principles compliance**, and ensures your project is **production-ready** with specific explanations based on what it finds in your code.

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

### 🏗️ **NEW: SOLID Architecture Analysis (v1.2.0)**
WOARU now includes **comprehensive SOLID principles checking** to make it a true **"Tech Lead in a Box"**:

- **🎯 Single Responsibility Principle (SRP)** - Detects classes with too many methods, high complexity, or multiple concerns
- **📊 SOLID Score (0-100)** - Quantified architecture quality with severity-weighted scoring
- **🔍 Detailed Violation Analysis** - Precise location, explanation, impact, and solution for each issue
- **🚀 Smart Recommendations** - Context-aware architectural improvement suggestions
- **⚙️ Seamless Integration** - Automatically runs during `woaru review` commands
- **🌍 Multi-language Support** - TypeScript/JavaScript (Python, Go, Rust coming soon)

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
woaru analyze        # Deep project analysis with security audit + SOLID analysis (★ NEW!)
woaru setup          # Auto-setup recommended tools
woaru helpers        # Show active vs missing tools (★ most useful)
woaru watch          # Start live quality monitoring with security (★ supervisor mode)
woaru review         # Code review: analyze only changed files with security + SOLID (★ NEW SUB-COMMANDS!)
woaru commands       # Show detailed command reference (★ NEW!)
```

### Status and Management
```bash
woaru status         # Show supervisor status
woaru recommendations # Show current recommendations
woaru stop           # Stop supervisor
woaru update-db      # Update tools database
woaru logs           # Show activity logs with filtering options (★ NEW!)
woaru message        # Send reports from history to configured channels
```

### Utility Commands
```bash
woaru ignore <tool>  # Ignore specific tools
woaru rollback <tool> # Rollback tool configurations
```

### 🆕 **Audit & Transparency Commands (v1.3.0)**
```bash
woaru logs                    # Show recent activity logs
woaru logs --tail 100        # Show last 100 log entries
woaru logs --project /path   # Filter logs by project path
woaru logs --action analyze  # Filter logs by action type
woaru logs --since 2024-01-01 # Time-based filtering
woaru logs --export json     # Export logs (json, csv, txt)
woaru logs clear             # Clear all activity logs
woaru logs stats             # Show log statistics

woaru message all            # Send all reports from history
woaru message latest         # Send latest report (with timestamp sorting)
```

## 🔍 **NEW: Revolutionary Review Sub-Commands (v1.1.0)**

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

## 🏗️ SOLID Architecture Analysis

📊 **SOLID Score: 65/100** (3 Verstöße gefunden)

### 🔴 Single Responsibility Principle (3 Verstöße)

#### 🟡 HOCH (2)

**1. Klasse UserManager hat 18 Methoden**
📍 **Klasse:** UserManager:15
💡 **Problem:** Klassen mit vielen Methoden haben oft mehrere Verantwortlichkeiten
⚠️ **Auswirkung:** Schwer zu testen, zu verstehen und zu warten
🔨 **Lösung:** Teile die Klasse UserManager in kleinere, fokussierte Klassen auf

**2. Klasse UserManager importiert aus 4 verschiedenen Bereichen: database, http, validation, email**
📍 **Klasse:** UserManager:15
💡 **Problem:** Imports aus verschiedenen Bereichen deuten auf multiple Verantwortlichkeiten hin
🔨 **Lösung:** Separiere die verschiedenen Concerns in eigene Services

### 💡 SOLID-Empfehlungen
1. 🎯 1 Klassen mit zu vielen Methoden - teile diese in kleinere Services auf
2. 📦 1 Klassen mit zu vielen verschiedenen Concerns - verwende Dependency Injection

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

## ✅ **Rock-Solid Stability & Reliability**

### 🛡️ **Watch Command - Now 100% Stable**

The `woaru watch` command has been completely reengineered for **bulletproof reliability**:

```bash
# Now runs indefinitely without timeouts in ANY environment
woaru watch

✅ WOARU Supervisor started successfully!
📍 Project: /your/project/path
👁️ Starting continuous monitoring...
👁️  WOARU is watching your project - Press Ctrl+C to stop

⏱️  Watching... (5s elapsed, 14:32:15)
⏱️  Watching... (10s elapsed, 14:32:20)
📊 Status: 42 files monitored, Health: 85/100
👁️  WOARU is watching your project - Press Ctrl+C to stop
```

### 🔧 **Technical Improvements**
- **⚡ 1-Second Heartbeat**: Aggressive keep-alive system prevents any timeouts
- **🔄 Smart Process Management**: Automatically detects and adapts to environment constraints
- **🛡️ Bulletproof Architecture**: Never loses connection or stops unexpectedly
- **🧪 Extensively Tested**: Works reliably across terminals, IDEs, and remote connections

### 🌍 **Universal Compatibility**
- ✅ **Native Terminals**: macOS Terminal, Windows Terminal, Linux shells
- ✅ **IDE Integration**: VS Code, Claude Code, JetBrains IDEs
- ✅ **Remote Sessions**: SSH, Docker containers, CI/CD environments
- ✅ **Cloud Environments**: GitHub Codespaces, GitLab WebIDE, AWS Cloud9

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

### ⚠️ **Important: Environment Requirements**

**WOARU works best in proper terminal environments:**

✅ **Recommended:**
- **Native Terminal** (macOS Terminal, Windows Terminal, Linux Terminal)
- **VS Code Integrated Terminal** 
- **Claude Code IDE Integration**
- **SSH Terminals**

❌ **Not Recommended:**
- **Claude Chat Web Interface** (timeout restrictions)
- **Claude MCP Chat** (timeout restrictions)
- **Browser-based terminals** (limited process management)

**Why?** Long-running commands like `woaru watch` require persistent process management that browser environments can't provide reliably.

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

**WOARU v1.1.0** - Your Universal Development Companion 🚀

## 🆕 **What's New in v1.1.0 - STABLE RELEASE**

### 🎯 **Revolutionary Review System**
- 🔄 **MAJOR: Review Sub-Commands** - `woaru review git|local|path` for ultra-precise analysis
- 📚 **NEW: Self-Documenting Commands** - `woaru commands` shows complete reference
- 🎯 **Ultra-Focused Reviews** - Analyze exactly what you need: git diffs, local changes, or specific paths
- ⚡ **Modular Architecture** - Shared analysis engine for consistent results across all review modes

### ✅ **Rock-Solid Stability**
- 🛡️ **FIXED: Watch Command Timeout** - Works perfectly in ALL environments including Claude Code
- 🚀 **Aggressive Heartbeat System** - 1-second keep-alive ensures continuous monitoring
- 🔄 **Bulletproof Process Management** - Never loses connection or times out
- 🧪 **Extensively Tested** - Proven stable across multiple environments and projects

### 🛠️ **Enhanced User Experience**
- 🎓 **Perfect for Teams** - Clear command separation for different workflows
- 🔍 **Smart Environment Detection** - Automatically adapts to terminal vs. IDE environments
- 📖 **Complete Documentation** - Every command thoroughly documented with examples

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

## 🔍 **LATEST: Enhanced Detailed Analysis with Precise Problem Locations (v1.1.1)**

### 🎯 **Ultra-Precise Problem Detection**

WOARU wurde massiv erweitert um **genaue Problem-Lokalisierung** und **detaillierte Begründungen** zu liefern:

#### **🔍 Enhanced Security Analysis Display**
```bash
🔍 DETAILLIERTE SICHERHEITSPROBLEME:
──────────────────────────────────────────────────

📦 SNYK-Befunde:

  KRITISCH (2):
  1. Remote Code Execution in lodash
     📍 Paket: lodash@4.17.20
     🆔 CVE: CVE-2021-23337
     💡 Problem: Command injection vulnerability allows remote code execution
     🔧 Lösung: Upgrade lodash to version 4.17.21

  2. SQL Injection in sequelize
     📍 Datei: src/models/User.js:45
     💡 Problem: Unsanitized user input allows SQL injection attacks
     🔧 Lösung: Use parameterized queries and update to latest version
```

#### **🏗️ Enhanced Production Readiness Display**
```bash
🏗️ PRODUCTION READINESS
────────────────────────────────────────

📋 SECURITY
   1. Missing SSL/TLS configuration in Express app
      📍 Betroffen: src/server.js:15, src/app.ts:23
      📦 Pakete: helmet, express-ssl-redirect
      💡 Prüfung: HTTPS enforcement check for production security
      🔧 Lösung: Install helmet middleware and enforce HTTPS in production

   2. No Content Security Policy headers detected
      📍 Betroffen: src/middleware/security.js
      💡 Prüfung: CSP headers prevent XSS and injection attacks
      🔧 Lösung: Configure CSP headers using helmet.contentSecurityPolicy()
```

#### **💡 Enhanced Review Reports with Detailed Code Context**
```bash
💡 **Problem:** 1 unbenutzte Variablen/Imports - können entfernt werden, 
                1 TypeScript-spezifische Probleme, 2 weitere Code-Qualitätsprobleme

📋 **Gefundene Probleme:**
1. Line 23:45 - ERROR: 'api_key' is assigned a value but never used (Rule: @typescript-eslint/no-unused-vars)
2. Line 10:1 - ERROR: 'console' is not defined (Rule: no-undef)

🔧 **Lösungsvorschläge:**
1. Entferne unbenutzte Variablen oder füge "_" vor den Namen hinzu
2. Ersetze console.log durch Logger oder entferne Debug-Ausgaben

📄 **Code-Kontext:**
```
src/api/users.ts:23:45
  23:45  error  'api_key' is assigned a value but never used  @typescript-eslint/no-unused-vars
  10:1   error  'console' is not defined                     no-undef
```

### 🚀 **Key Enhancements Implemented**

#### **1. 📍 Precise Location Information**
- **Package locations**: `📍 Paket: package-name@version`
- **File locations**: `📍 Datei: path/file.js:line`
- **CVE identifiers**: `🆔 CVE: CVE-2023-1234`
- **Affected files**: Lists all files impacted by each issue

#### **2. 💡 Detailed Problem Explanations**
- **Why it's problematic**: Clear explanation of the security/quality risk
- **Impact assessment**: What could happen if the issue is not fixed
- **Context-aware descriptions**: Tailored explanations based on issue type

#### **3. 🔧 Actionable Solution Recommendations**
- **Specific fix commands**: Exact npm/package commands to run
- **Step-by-step guidance**: Clear instructions for remediation
- **Alternative solutions**: Multiple approaches when applicable

#### **4. 🎯 Smart Categorization System**
```bash
Enhanced ESLint Analysis Categories:
- Syntax errors: Critical parsing issues
- Unused variables: Clean-up opportunities  
- Formatting issues: Style and consistency problems
- Security issues: Potential vulnerabilities (🚨 Critical priority)
- Import/Export problems: Module resolution issues
- TypeScript-specific: Type safety improvements
```

#### **5. 🌍 German Language Support**
All problem explanations, solutions, and recommendations are provided in German for maximum accessibility to German-speaking development teams.

### 📊 **Commands Enhanced**

- **`woaru analyze`** - Now shows detailed security findings with precise locations and explanations
- **`woaru review git/local/path`** - Enhanced reports with code context and fix suggestions
- **All security scanning** - Integrated detailed location tracking across all security tools

### 🎯 **Perfect for Production Teams**

Diese Erweiterungen machen WOARU zum **ultimativen Code-Quality-Experten** der nicht nur Probleme findet, sondern auch genau erklärt:
- **WO** das Problem liegt (Datei:Zeile, Paket@Version)
- **WARUM** es ein Problem ist (Sicherheitsrisiko, Qualitätsproblem)
- **WIE** es zu lösen ist (Konkrete Befehle und Schritte)

**WOARU v1.1.1** - Jetzt mit chirurgischer Präzision für Problemdiagnose! 🎯🔬