# Contributing to WOARU (WorkAroundUltra)

Thank you for your interest in contributing to WOARU! This guide will help you understand our development workflow, AI-friendly architecture, and critical npm packaging requirements.

## 🤖 **KI-freundliche Regelwelt** (AI-Friendly Rule World)

WOARU has been architected as an **AI-friendly rule world** that follows strict patterns and validation rules. This makes the codebase predictable, safe, and optimal for AI assistants to work with.

### 🛡️ Core Architecture Principles

#### **Schema-Zwang** (Schema Enforcement)
**REGEL**: All configuration files MUST be validated against Zod schemas before use.

```typescript
// ✅ CORRECT: Always validate before using config
const validation = SchemaValidator.validateAIConfig(config);
if (!validation.success) {
  throw new Error('Config validation failed');
}
const safeConfig = validation.data;

// ❌ WRONG: Never use raw config without validation
const unsafeConfig = JSON.parse(configFile); // No validation!
```

**Schema Files**:
- `src/schemas/ai-config.schema.ts` - AI configuration validation
- All schemas include German error messages for user feedback
- Use `SchemaValidator` class for consistent validation

#### **Hook-System** (Event-Based Extensibility)
**REGEL**: All major operations MUST trigger hooks for extensibility.

```typescript
// ✅ CORRECT: Always trigger hooks around operations
await triggerHook('beforeFileAnalysis', {
  filePath: sanitizedPath,
  language: context.language,
  contentLength: context.contentLength,
  timestamp: Date.now()
});

const result = await performOperation();

await triggerHook('afterFileAnalysis', {
  filePath: sanitizedPath,
  findingsCount: result.length,
  analysisTime: Date.now() - startTime,
  timestamp: Date.now()
});
```

**Hook System Features**:
- EventEmitter-based architecture in `src/core/HookSystem.ts`
- Priority-based execution with error isolation
- Built-in debug mode and performance tracking
- Type-safe hook data interfaces

#### **Regelwelt Best Practices**

1. **🔒 Validation First**: Never trust input data - validate everything
2. **🪝 Hook Everything**: Major operations should be extensible via hooks  
3. **📝 Type Safety**: Use TypeScript strictly - no `any` types allowed
4. **🐛 Error Isolation**: Hooks and validators must not crash the main flow
5. **📊 Observability**: All operations should be observable via hooks

### 🏗️ Architecture Components

#### **Configuration Management** (`src/config/ConfigManager.ts`)
- Zod schema validation for `ai_config.json`
- Metadata key filtering (excludes `_metadata`, `multi_ai_review_enabled`, etc.)
- German error messages for validation failures
- Secure permission handling

#### **Hook System** (`src/core/HookSystem.ts`)
```typescript
// Register a hook handler
registerHook('beforeFileAnalysis', async (data) => {
  console.log(`Analyzing ${data.filePath}...`);
}, 10); // Priority 10

// Trigger hooks with error isolation
await triggerHook('afterFileAnalysis', analysisData);
```

#### **Schema Validation** (`src/schemas/ai-config.schema.ts`)
```typescript
// AI Provider Configuration Schema
const LLMProviderConfigSchema = z.object({
  id: z.string().min(1, "Provider ID darf nicht leer sein"),
  providerType: ProviderTypeSchema,
  apiKeyEnvVar: z.string().regex(/^[A-Z_]+$/),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  enabled: z.boolean()
});

// Use the validator
const result = SchemaValidator.validateAIConfig(rawConfig);
if (result.success) {
  // Safe to use result.data
}
```

### 🚨 Architecture Rules for AI Assistants

When working on WOARU, AI assistants (like Claude) MUST follow these rules:

#### **Rule 1: Schema-First Development**
- **BEFORE** saving any config: Validate with Zod schema
- **BEFORE** loading any config: Validate with Zod schema  
- **NEVER** bypass validation "for speed" or "temporarily"

#### **Rule 2: Hook-Driven Extensions**
- **ADD** hooks to any new major operation
- **TRIGGER** existing hooks when extending functionality
- **RESPECT** hook priorities and error isolation

#### **Rule 3: German Error Messages**
- **USE** German messages for user-facing errors (matching user's language)
- **INCLUDE** technical details in debug logs (can be English)
- **PROVIDE** actionable suggestions in error messages

#### **Rule 4: Predictable Patterns**
```typescript
// ✅ PREDICTABLE: Standard validation pattern
async function loadConfig(): Promise<ConfigType> {
  const raw = await fs.readFile(configPath, 'utf-8');
  const validation = SchemaValidator.validateConfig(JSON.parse(raw));
  if (!validation.success) {
    throw new ConfigValidationError(validation.errors);
  }
  return validation.data;
}

// ✅ PREDICTABLE: Standard hook pattern  
async function processFile(file: string): Promise<Result> {
  await triggerHook('beforeProcess', { file });
  try {
    const result = await actualProcessing(file);
    await triggerHook('afterProcess', { file, result });
    return result;
  } catch (error) {
    await triggerHook('onProcessError', { file, error });
    throw error;
  }
}
```

### 🔍 Code Review Checklist for Regelwelt

When reviewing WOARU code, ensure:

- [ ] **Schema Validation**: All config loading/saving uses Zod validation
- [ ] **Hook Integration**: Major operations trigger appropriate hooks
- [ ] **Error Handling**: Validation errors include helpful German messages
- [ ] **Type Safety**: No `any` types, proper TypeScript usage
- [ ] **Security**: Input sanitization and secure file operations
- [ ] **Observability**: Operations are traceable via hooks and logs
- [ ] **Consistency**: Follows established patterns and conventions

### 📚 Learning the Regelwelt

For new contributors, start by studying these key files:
1. `src/schemas/ai-config.schema.ts` - Learn the validation patterns
2. `src/core/HookSystem.ts` - Understand the hook architecture
3. `src/config/ConfigManager.ts` - See schema validation in action
4. `src/analyzer/CodeSmellAnalyzer.ts` - Example of hook integration

## 🚨 Critical: NPM Packaging Requirements

WOARU must work out-of-the-box with `npx woaru` without any manual intervention. This requires careful attention to our packaging configuration.

### Essential Files for npm Package

The following files/directories are **CRITICAL** and must be included in every npm release:

#### Core Application Files
- `dist/` - Compiled TypeScript output
- `README.md` - Package documentation
- `LICENSE` - License information

#### Runtime Dependencies (CRITICAL for supervisor)
- `tools/` - Tool configurations and definitions
- `ai-models.json` - AI provider configurations
- `templates/` - AI prompt templates
- `locales/` - Translation files
- `src/database/tools-db.json` - Tools database
- `src/database/tools-db-schema.json` - Database schema

### Package.json Configuration

Our `package.json` includes a `files` array that defines what gets packaged:

```json
{
  "files": [
    "dist",
    "README.md", 
    "LICENSE",
    "tools/",
    "ai-models.json",
    "templates/",
    "locales/",
    "src/database/tools-db.json",
    "src/database/tools-db-schema.json"
  ]
}
```

**⚠️ WARNING**: Never remove items from this array without thorough testing!

## 🔧 Development Workflow

### 1. Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/your-org/woaru.git
cd woaru

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Making Changes

1. **Code Changes**: Make your changes in the `src/` directory
2. **Build**: Always run `npm run build` after changes
3. **Test Locally**: Use `npm run test:local` to test the built package
4. **Validate**: Run `npm run validate:package` before committing

### 3. Testing Your Changes

#### Local Package Testing (MANDATORY)

Before committing any changes that affect the build or packaging:

```bash
# 1. Build the project
npm run build

# 2. Validate package contents
npm run validate:package

# 3. Create a test package
npm pack

# 4. Test installation in a separate directory
mkdir test-install && cd test-install
npm install ../woaru-*.tgz

# 5. Test the CLI works
npx woaru --version
npx woaru init test-project
```

#### Automated Testing

```bash
# Run all tests
npm test

# Run linting
npm run lint

# Run type checking
npm run typecheck
```

## 🏗️ Build Process Details

Our build process consists of several critical steps:

### 1. TypeScript Compilation
```bash
npm run build:ts
```
- Compiles TypeScript to JavaScript in `dist/`
- Generates source maps and type definitions

### 2. Asset Copying
```bash
npm run build:assets
```
- Copies critical runtime files to `dist/`
- Includes tools/, templates/, locales/, etc.

### 3. ES Module Fixes
```bash
npm run build:fix-esm
```
- Adds `.js` extensions to imports
- Fixes `__dirname` usage in ES modules

### 4. Package Validation
```bash
npm run validate:package
```
- Verifies all critical files are present
- Checks package.json configuration

## 🔍 Common Issues and Solutions

### "Failed to start supervisor: tools directory not found"

**Cause**: The `tools/` directory is missing from the npm package.

**Solution**: 
1. Ensure `tools/` is in `package.json` files array
2. Verify `scripts/copy-assets.js` copies the tools directory
3. Run `npm run validate:package` to confirm

### ES Module Import Errors

**Cause**: Missing `.js` extensions or `__dirname` usage in ES modules.

**Solution**:
1. Run `npm run build:fix-esm` 
2. Check `scripts/fix-esm-imports.js` and `scripts/fix-dirname-esm.js`

### Package Size Issues

Monitor package size with:
```bash
npm pack --dry-run
```

Large packages may indicate unnecessary files being included.

## 📦 Release Process

### Pre-Release Checklist

Before creating any release:

- [ ] All tests pass (`npm test`)
- [ ] Build completes without errors (`npm run build`)
- [ ] Package validation passes (`npm run validate:package`)
- [ ] Local installation test completed successfully
- [ ] Version number updated in `package.json`
- [ ] CHANGELOG.md updated with changes

### Creating a Release

1. **Version Bump**:
   ```bash
   npm version patch  # or minor/major
   ```

2. **Final Validation**:
   ```bash
   npm run build
   npm run validate:package
   npm run test:local
   ```

3. **Publish**:
   ```bash
   npm publish
   ```

4. **Verify Published Package**:
   ```bash
   # Test in clean environment
   npx woaru@latest --version
   ```

## 🧪 Testing Guidelines

### Unit Tests
- Write tests for all new functionality
- Maintain > 80% code coverage
- Use Jest for testing framework

### Integration Tests
- Test CLI commands end-to-end
- Verify file operations work correctly
- Test AI provider integrations

### Package Tests
- Always test `npm pack` before releases
- Verify `npx woaru` works in clean environments
- Test major workflows (init, analyze, etc.)

## 🚨 Security Considerations

### API Keys and Secrets
- Never commit API keys or secrets
- Use ConfigManager for secure key storage
- Test that .env files are properly gitignored

### File Permissions
- Ensure config files have secure permissions (600)
- Test permission handling on different platforms

## 🔧 Development Tools

### VS Code Configuration
Recommended extensions:
- TypeScript and JavaScript Language Features
- ESLint
- Prettier
- GitLens

### Environment Setup
```bash
# Set up git hooks
npm run prepare

# Enable TypeScript strict mode
# (already configured in tsconfig.json)
```

## 📋 Code Style Guidelines

### TypeScript
- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Document complex functions with JSDoc

### File Organization
- Keep files under 500 lines
- Use clear directory structure
- Separate concerns (config, utils, commands, etc.)

### Error Handling
- Always handle async operations properly
- Use meaningful error messages
- Implement graceful degradation where possible

## 🤝 Pull Request Guidelines

### Before Submitting
1. **Test Locally**: Run full test suite and package validation
2. **Update Documentation**: Update README.md if needed
3. **Check Dependencies**: Ensure no unnecessary dependencies added
4. **Verify Backwards Compatibility**: Test with existing configurations

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Package validation passes
- [ ] Local `npm pack` test completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or clearly documented)
```

## 🐛 Debugging Common Issues

### Build Failures
1. Check TypeScript errors: `npm run typecheck`
2. Verify all imports have correct paths
3. Ensure all required files exist

### Runtime Errors
1. Check if all assets were copied: `ls dist/`
2. Verify file permissions are correct
3. Test in clean environment to isolate issues

### Performance Issues
1. Use built-in profiling: `npm run analyze`
2. Check for memory leaks in long-running processes
3. Monitor file system operations

## 📞 Getting Help

### Documentation
- [README.md](./README.md) - Basic usage and setup
- [API Documentation](./docs/api.md) - Detailed API reference
- [Architecture Guide](./docs/architecture.md) - System design overview

### Community
- GitHub Issues: Report bugs and request features
- GitHub Discussions: Ask questions and share ideas

### Development Support
- Code review: All PRs receive thorough review
- Mentoring: New contributors get guidance on complex features

---

## ⚠️ Important Reminders

1. **NEVER** skip the package validation step
2. **ALWAYS** test `npx woaru` after package changes
3. **DOCUMENT** any changes to the build process
4. **TEST** in clean environments before releasing
5. **VERIFY** backwards compatibility with existing installations

Remember: Users expect `npx woaru` to work immediately without manual setup. Our packaging must be bulletproof!