# Translation Build Integration

This directory contains scripts for validating and bundling translations during the build process.

## 🚀 Quick Start

```bash
# Development build (lenient validation)
npm run build

# Production build (strict validation)
npm run build:prod

# Validate translations only
npm run validate:translations:dev
```

## 📋 Available Scripts

### Build Scripts
- `npm run build` - Standard build with development-mode validation
- `npm run build:fast` - Skip translation bundling (faster development)
- `npm run build:prod` - Production build with strict validation

### Validation Scripts
- `npm run validate:translations` - Default validation mode
- `npm run validate:translations:dev` - Development mode (lenient)
- `npm run validate:translations:strict` - Strict mode for production

### Translation Scripts
- `npm run bundle:translations` - Bundle translations without full build

## 🔧 How It Works

### 1. Translation Validation (`validate-translations.js`)

Validates translation files for:
- **Completeness**: Ensures minimum percentage of translations are filled
- **Consistency**: Compares keys across languages  
- **Quality**: Detects placeholder text and empty values

**Validation Modes:**
- **Development**: Lenient rules, warnings for missing translations
- **Default**: Balanced validation for regular builds
- **Strict**: Production-ready validation, requires 95%+ completion

### 2. Translation Bundling (`bundle-translations.js`)

1. **Validates** translations first (fails build if validation fails)
2. **Bundles** all translation files into a single TypeScript module
3. **Generates metadata** with statistics and build information
4. **Creates types** for TypeScript integration

### 3. Build Integration

The build process automatically:
1. Validates translations in development mode
2. Bundles validated translations into `src/generated/translations.ts`
3. Compiles TypeScript (including generated translations)
4. Copies assets

## 📊 Validation Configuration

Edit `translation-config.js` to customize validation rules:

```javascript
{
  // Minimum completion percentage per language
  minimumCompletion: {
    'en': 90,  // English (reference language)
    'de': 85   // German
  },

  // Maximum allowed missing keys
  maxMissingKeys: {
    'en': 30,
    'de': 100
  },

  // Keys allowed to be empty
  allowEmptyKeys: [
    'cli.ai_control_center.continue_prompt',
    'cli.setup.loading_models'
  ]
}
```

## 📈 Validation Output

### ✅ Success Example
```
📊 Translation Statistics:
  EN: 576 valid 23 empty (96% complete)
  DE: 639 valid 23 empty (97% complete)

✅ No critical errors found!
⚠️  4 warnings can be addressed later
```

### ❌ Error Example
```
❌ Errors found:
  • en: 15 empty translations (85% complete, minimum 90%)
    Keys: welcome_message, cli.main.description, version.display

💡 Please fix the above errors before building.
```

## 🔄 Development Workflow

### Adding New Translations

1. **Add keys to reference language** (`locales/en/translation.json`)
2. **Run validation** to see what's missing:
   ```bash
   npm run validate:translations:dev
   ```
3. **Add translations** to other languages
4. **Build** to validate and bundle:
   ```bash
   npm run build
   ```

### Handling Build Failures

If the build fails due to translations:

1. **Check validation output** for specific issues
2. **Use development validation** for details:
   ```bash
   npm run validate:translations:dev
   ```
3. **Fix empty translations** or mark as allowed in config
4. **Ensure consistency** across all languages

### Production Releases

Before releasing:

1. **Run strict validation**:
   ```bash
   npm run validate:translations:strict
   ```
2. **Fix all critical issues** (empty translations, missing keys)
3. **Use production build**:
   ```bash
   npm run build:prod
   ```

## 🛠 Generated Files

### `src/generated/translations.ts`

Auto-generated TypeScript module containing:
- **bundledTranslations**: All translation data
- **translationMetadata**: Build info and statistics  
- **Type definitions**: TypeScript types for translations

**Example:**
```typescript
export const translationMetadata = {
  generatedAt: '2025-07-30T06:13:25.650Z',
  languages: ['en', 'de'],
  stats: { en: 599, de: 662 },
  totalLanguages: 2,
  buildVersion: '5.2.2',
  validated: true
} as const;
```

## 🚨 Troubleshooting

### Build Fails with Translation Errors

**Problem**: `❌ Translation validation failed! Build aborted.`

**Solutions:**
1. Run `npm run validate:translations:dev` for detailed output
2. Fix empty translations or add to `allowEmptyKeys` in config
3. Add missing translation keys to maintain consistency
4. Use `npm run build:fast` to skip validation temporarily

### Too Many Validation Warnings

**Problem**: Many warnings about missing keys

**Solutions:**
1. Increase `maxMissingKeys` in `translation-config.js`
2. Add language-specific exceptions in `allowMissingKeys`
3. Complete missing translations for better quality

### Generated File Issues

**Problem**: TypeScript errors in generated translations

**Solutions:**
1. Ensure translation JSON files are valid
2. Run `npm run bundle:translations` to regenerate
3. Check for special characters or invalid JSON syntax

## 📚 Best Practices

1. **Keep English as reference** - Most complete translation set
2. **Use meaningful keys** - Descriptive, hierarchical structure  
3. **Validate early** - Run validation during development
4. **Complete core translations** - Focus on user-facing text
5. **Use strict mode for releases** - Ensure production quality

## 🔗 Integration Points

### CI/CD Pipeline
```yaml
- name: Validate Translations
  run: npm run validate:translations:strict

- name: Build with Validation  
  run: npm run build:prod
```

### Pre-commit Hooks
```json
{
  "pre-commit": [
    "npm run validate:translations:dev"
  ]
}
```

This system ensures translation quality while maintaining build performance and developer productivity.