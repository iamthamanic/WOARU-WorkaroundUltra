# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.3.1] - 2025-08-04

### Fixed
- **🛡️ CRITICAL SECURITY FIXES** - Eliminated all code injection vulnerabilities
  - Fixed `eval()` code injection vulnerability in TemplateEngine with secure expression evaluation
  - Replaced `execSync()` with secure `spawn()` in VersionManager and StartupCheck
  - Added comprehensive input validation with 15+ unsafe pattern detection
  - Implemented secure template condition evaluation with restricted scope
  
- **📦 NPM Package Completeness** - Resolved package distribution issues  
  - Fixed missing `tools/`, `templates/`, `ai-models.json`, and `locales/` in npm package
  - Enhanced `copy-assets.js` script to ensure all critical runtime files are included
  - Added `validate-package.js` script with comprehensive pre-publish validation
  - Updated `package.json` files array to include all necessary runtime dependencies

- **🤖 Enhanced AI Provider Support** - Improved model handling and categorization
  - Added Claude 4 model support (claude-4-opus-20250115, claude-4-sonnet-20250115)
  - Enhanced DeepSeek integration with reasoning models (deepseek-reasoner)
  - Improved model recommendation system with tier-based categorization
  - Better fallback handling and error recovery for AI provider failures

- **🏗️ Build System Improvements** - Stabilized compilation and asset handling
  - Fixed ES module import issues in compiled JavaScript files
  - Enhanced translation bundling with better validation and error reporting
  - Improved TypeScript configuration for better ES module compatibility
  - Optimized asset copying pipeline for faster builds

### Changed
- **🔧 Development Workflow** - Enhanced developer experience
  - Improved Jest configuration for better ES module support
  - Enhanced ESLint configuration with stricter type checking
  - Better error handling and logging throughout the application
  - Optimized build scripts for faster development cycles

### Security
- **🔒 Comprehensive Security Audit** - All vulnerabilities resolved
  - **FIXED**: CWE-94 Code Injection via eval() usage
  - **FIXED**: CWE-78 OS Command Injection via execSync() 
  - **IMPLEMENTED**: Secure expression evaluation with input sanitization
  - **ADDED**: Automated security testing to prevent regression
  - **VERIFIED**: All security fixes validated with comprehensive test suite

## [5.3.0] - 2025-07-30

### Added
- **🚀 Interactive Project Initialization (`woaru init`)** - Complete project scaffolding system
  - Interactive project type selection with Next.js and Python FastAPI templates
  - Feature-based configuration with Tailwind CSS, Testing, Database, and Authentication options
  - Non-interactive mode for CI/CD integration (`--non-interactive`)
  - Dry-run mode for preview without file creation (`--dry-run`)
  - Automatic Git repository initialization and dependency installation
  - Template engine with Handlebars for dynamic content generation
  - Comprehensive project structure generation with best practices
  
- **📋 Translation Validation System** - Production-ready i18n quality assurance
  - Enhanced `TranslationValidator` class with severity-based issue reporting
  - Build integration script (`scripts/validate-translations.js`)
  - Configurable validation rules with language-specific exceptions
  - Empty value detection and placeholder consistency checking
  - Completion percentage tracking and detailed reporting
  - CLI integration with development and strict modes
  
- **📤 Message Handler System** - Advanced report management
  - New `MessageHandler` class for reading and filtering WOARU reports
  - Webhook integration for Slack/Discord compatibility
  - Security validation for URLs and file operations
  - CLI integration via `woaru message` command
  - Support for multiple report types and filtering options
  
- **📚 Enhanced CLI Experience**
  - Improved command help system with detailed examples
  - Better internationalization support throughout CLI
  - Professional formatting and comprehensive command reference
  - Enhanced error handling and user-friendly messages

### Changed
- **🔧 Build Process Enhancement**
  - Translation validation now runs automatically during build
  - Improved bundling process with validation feedback
  - Better error reporting during compilation
  
- **🌍 Internationalization Improvements**
  - Updated translation files for new features
  - Consistent i18n key structure across all components
  - Enhanced translation validation with configurable rules
  
- **⚙️ Configuration System**
  - Added Handlebars dependency for template processing
  - Enhanced package.json with new script commands
  - Improved translation bundling with validation integration

### Fixed
- **🔒 Security Enhancements**
  - Input sanitization to prevent injection attacks
  - Secure file operations with proper permissions
  - Configuration validation for AI provider setup
  - Enhanced error handling throughout the system

### Technical Details
- **New Dependencies**: `handlebars@^4.7.8`, `@types/handlebars@^4.1.0`
- **New CLI Commands**: `woaru init`, enhanced `woaru commands`, `woaru message`
- **New Scripts**: `validate:translations`, `validate:translations:strict`
- **Build Integration**: Translation validation in CI/CD pipeline
- **Template System**: Complete project scaffolding with 2 built-in templates

### Migration Guide
- **No Breaking Changes** - All existing functionality remains unchanged
- **New Features** - All new commands are additive and optional
- **Translation Files** - Existing translations remain compatible
- **Build Process** - Existing build commands continue to work

## [5.2.2] - 2025-07-14

### Fixed
- Improved splash screen rendering and frame alignment
- Fixed splash screen layout overflow with text extending beyond borders
- Fixed right frame interruption in splash screen - frame now fully closed

## [5.2.1] - Previous Release

### Fixed
- Fixed AI control center translation keys showing raw keys instead of translated text

## [5.2.0] - Previous Release

### Added
- Implemented comprehensive WOARU documentation command

---

## Release Notes

### v5.3.0 Highlights

This release introduces **major productivity enhancements** for developers:

🎯 **Instant Project Setup**: The new `woaru init` command creates production-ready projects in seconds with industry best practices built-in.

🌍 **Translation Quality Assurance**: Automated validation ensures your internationalized applications maintain high quality across all languages.

📊 **Advanced Reporting**: Share analysis results seamlessly through webhooks to team collaboration tools.

### Upgrade Instructions

```bash
# Update to latest version
npm update -g woaru

# Verify installation
woaru --version  # Should show 5.3.0

# Try the new init command
woaru init

# Validate translations
woaru validate:translations
```

### What's Next

- Additional project templates (Vue.js, Angular, Django)
- Enhanced AI integrations
- Team collaboration features
- Advanced code analysis capabilities