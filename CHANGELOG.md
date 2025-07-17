# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.0] - 2025-07-17

### Added
- **MAJOR: Revolutionary Just-in-Time i18n for CLI Commands**
  - Implemented complete Just-in-Time localization system for all CLI commands
  - Created `I18nCommand.ts` utility class extending Commander.js with i18n support
  - Created `commandHelpers.ts` with comprehensive command mapping and translation functions
  - Added dynamic translation for all 67+ commands based on user's language preference
  - Commands now display correctly in German/English after language switching
  - Enhanced `woaru commands` action to use dynamic translation with real-time language detection

### Technical Implementation
- **New Files:**
  - `src/utils/I18nCommand.ts` - Extended Command class with i18n capabilities
  - `src/utils/commandHelpers.ts` - Command mapping and translation logic
- **Enhanced Translation Files:**
  - Added comprehensive command translations to `locales/en/translation.json`
  - Added comprehensive command translations to `locales/de/translation.json`
  - All command descriptions, purposes, and help text now fully translatable
- **CLI Integration:**
  - Updated commands action in `src/cli.ts` to initialize i18n and use dynamic translation
  - Added automatic language detection and translation key mapping
  - Implemented fallback support for missing translations

### Breaking Changes
- Command output format has changed to support dynamic translation
- CLI commands now require i18n initialization for proper display

## [4.9.0] - 2025-07-17

### Changed
- **BREAKING CHANGE**: Refactored core engine from `WAUEngine` to `WOARUEngine` for consistent naming throughout the project
  - Updated all imports and references to use the new `WOARUEngine` class name
  - Renamed test files and updated all test descriptions accordingly
  - This is a breaking change for programmatic users importing the engine directly

### Fixed
- Fixed critical timeout issues in WAUEngine (now WOARUEngine) unit tests
  - Resolved infinite loops in security analysis methods
  - Improved mocking of external dependencies (child_process, util.promisify)
  - Tests now complete in ~1.3 seconds instead of timing out after 2+ minutes
- Fixed all failing tests in ConfigManager unit test suite
  - Resolved mock setup issues for backward compatibility
  - Fixed environment variable parsing tests
  - Fixed console.warn mocking and floating-point precision issues
- Fixed all failing tests in UsageTracker unit test suite
  - Improved timestamp handling in tests
  - Fixed persistence and file system mock implementations
  - Achieved 100% test success rate (44/44 tests passing)

### Added
- Comprehensive test coverage improvements
  - Added robust mocking infrastructure for all core components
  - Enhanced error handling tests for edge cases
  - Improved test isolation and reliability

### Technical Details
- **Test Success Rates**: 
  - WOARUEngine: 41/41 tests passing (100%)
  - ConfigManager: 48/48 tests passing (100%)
  - UsageTracker: 44/44 tests passing (100%)
  - Total: 133/133 unit tests passing
- **Performance**: All tests now complete in under 2 seconds
- **Reliability**: Eliminated all timeout and flaky test issues

## [4.8.0] - 2025-07-17

### Added
- Initial release with comprehensive project analysis capabilities
- Multi-language support (TypeScript, JavaScript, Python, Java, etc.)
- Security analysis and production readiness auditing
- Tool recommendation engine
- CLI interface with interactive commands
- Configuration management system
- Usage tracking and statistics