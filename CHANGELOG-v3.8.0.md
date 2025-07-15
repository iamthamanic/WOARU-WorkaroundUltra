# WOARU v3.8.0 Release Notes
**Release Date:** July 15, 2025

## 🚀 MAJOR: Comprehensive Version & Update Management System

### 🆕 Added

#### **New Commands**
- **`woaru version`** - Display current WOARU version
  - Clean, simple version display: `WOARU Version: 3.8.0`
  - Reads version directly from package.json for accuracy

- **`woaru version check`** - Check for updates from NPM registry
  - Compares current version with latest NPM version
  - Shows release date of latest version
  - Provides clear update recommendations

- **`woaru update`** - Update WOARU to latest version
  - Spawns `npm install -g woaru@latest` with live output
  - Robust error handling and progress feedback
  - Automatic success/failure detection

#### **Proactive Startup System**
- **Automatic Version Checking** with intelligent 24-hour caching
  - Non-blocking background checks on every WOARU start
  - Interactive update prompts when new versions are available
  - Cache stored in `~/.woaru/startup-cache.json`

- **Environment Dependency Validation**
  - **Git Detection**: Critical for `woaru review git` functionality
  - **Docker Detection**: Optional for containerization checks
  - **Snyk Detection**: Optional for enhanced security analysis
  - Clear warnings for missing dependencies

#### **Smart User Experience**
- **Interactive Update Prompts**: "Eine neue Version ist verfügbar! Möchtest du jetzt updaten?"
- **Silent Mode**: Startup checks don't interrupt normal workflow
- **Intelligent Caching**: Only checks NPM registry once per day
- **Graceful Degradation**: Functions normally even if update checks fail

### 🔧 Technical Implementation

#### **New Files**
- `src/utils/versionManager.ts` - Core version management functionality
- `src/utils/startupCheck.ts` - Proactive system validation
- `VERSION_MANAGEMENT_FEATURES.md` - Comprehensive feature documentation

#### **Enhanced CLI Integration**
- Version commands integrated into main CLI with Commander.js
- Startup checks automatically initialized before any command execution
- Error handling with fallback mechanisms

#### **NPM Registry Integration**
- Live version checking via `npm view woaru version`
- Release date retrieval via `npm view woaru time.modified`
- Secure process spawning for updates

### 💡 User Benefits

#### **For Individual Developers**
- **Always Up-to-Date**: Automatic notifications about new versions
- **Transparent Control**: Clear version information and update choices
- **Reduced Friction**: One-command updates with progress feedback

#### **For Development Teams**
- **Consistency**: Standardized version management across team
- **Proactive Maintenance**: Early detection of environment issues
- **Professional Workflow**: Enterprise-grade update management

### 🛡️ Security & Reliability

#### **Secure Update Process**
- **Process Isolation**: Updates run in separate child processes
- **User Control**: No automatic updates without explicit consent
- **Error Recovery**: Robust fallback mechanisms

#### **Caching Security**
- **Local Storage**: Cache files only in user's `~/.woaru/` directory
- **Time-based Invalidation**: 24-hour cache expiration
- **Fallback Resilience**: Works even if caching fails

### 🎯 Example Usage

```bash
# Check current version
woaru version
# Output: WOARU Version: 3.8.0

# Check for updates
woaru version check
# Output: 📦 Eine neue Version (v3.8.1) ist verfügbar!
#         Veröffentlicht am: 16.07.2025

# Update to latest version
woaru update
# Output: 🚀 Updating WOARU to latest version...
#         ✅ Update erfolgreich abgeschlossen!

# Normal usage with automatic checks
woaru analyze
# Output: 📋 Hinweise:
#         💡 Eine neue Version ist verfügbar. Führe 'woaru update' aus.
```

### 🔍 Environment Validation Example

```bash
woaru analyze
# Output: ❌ Startup-Probleme:
#         ⚠️ WARNUNG: Git wurde nicht in deinem System gefunden
#         
#         📋 Hinweise:
#         💡 TIPP: Docker ist nicht verfügbar. Containerisierung-Checks werden übersprungen.
```

### 🚀 Impact

This release transforms WOARU from a development tool into a **self-maintaining, enterprise-grade system** that:
- **Stays Current**: Automatic version awareness and update management
- **Validates Environment**: Proactive detection of missing dependencies
- **Enhances Productivity**: Reduces manual maintenance overhead
- **Improves Reliability**: Robust error handling and graceful degradation

## 🔄 Backward Compatibility

- **Fully Backward Compatible**: All existing commands work unchanged
- **Optional Features**: New startup checks are non-blocking
- **Graceful Fallbacks**: System works normally even if new features fail

## 📈 Performance

- **Efficient Caching**: 24-hour cache reduces network requests
- **Non-blocking Checks**: Startup validation doesn't delay command execution
- **Optimized Updates**: Process isolation ensures system stability

---

**WOARU v3.8.0** - Professional Version Management for Modern Development Teams 🚀

### Previous Release: v3.7.1 - Critical Bug-Fix Release
For details about the previous release, see [CHANGELOG-v3.7.0.md](CHANGELOG-v3.7.0.md).