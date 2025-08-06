# WOARU Release Checklist

This checklist ensures that every WOARU release works perfectly with `npx woaru` out-of-the-box.

## 🚨 Critical Pre-Release Steps

### 1. Code Quality & Testing

- [ ] **All tests pass**: `npm test`
- [ ] **Linting passes**: `npm run lint` 
- [ ] **Type checking passes**: `npm run typecheck`
- [ ] **Build completes successfully**: `npm run build`
- [ ] **No console errors or warnings** in build output

### 2. Package Validation (MANDATORY)

- [ ] **Package validation passes**: `npm run validate:package`
- [ ] **Critical files verification**:
  - [ ] `dist/` directory exists and contains compiled JS
  - [ ] `tools/` directory copied to package
  - [ ] `ai-models.json` present
  - [ ] `templates/` directory present
  - [ ] `locales/` directory present
  - [ ] `src/database/tools-db.json` present
  - [ ] `src/database/tools-db-schema.json` present

### 3. Local Installation Testing (MANDATORY)

```bash
# Create test package
npm pack

# Test in clean directory
mkdir test-release && cd test-release
npm install ../woaru-*.tgz

# Verify CLI works
npx woaru --version
npx woaru init test-project
npx woaru analyze
```

- [ ] **CLI version displays correctly**
- [ ] **`npx woaru init` works without errors**
- [ ] **`npx woaru analyze` works without errors**
- [ ] **No "tools directory not found" errors**
- [ ] **All AI providers load correctly**
- [ ] **Templates are accessible**
- [ ] **Localization works**

### 4. Documentation Updates

- [ ] **Version updated in `package.json`**
- [ ] **CHANGELOG.md updated with new features/fixes**
- [ ] **README.md updated if needed**
- [ ] **API documentation updated if needed**

### 5. Version Management

- [ ] **Version follows semantic versioning**:
  - Patch (x.x.X): Bug fixes, no breaking changes
  - Minor (x.X.x): New features, backwards compatible
  - Major (X.x.x): Breaking changes

```bash
# Version bump
npm version patch  # or minor/major
```

## 🔍 Release Testing Matrix

Test the following scenarios before release:

### Operating Systems
- [ ] **macOS**: `npx woaru --version`
- [ ] **Linux**: `npx woaru --version` 
- [ ] **Windows**: `npx woaru --version`

### Node.js Versions
- [ ] **Node 18**: Minimum supported version
- [ ] **Node 20**: Current LTS
- [ ] **Node 22**: Latest stable

### Package Managers
- [ ] **npm**: `npx woaru`
- [ ] **yarn**: `yarn dlx woaru`
- [ ] **pnpm**: `pnpm dlx woaru`

### Installation Methods
- [ ] **Global install**: `npm install -g woaru && woaru --version`
- [ ] **npx direct**: `npx woaru --version`
- [ ] **Local project**: `npm install woaru && npx woaru --version`

## 📦 Publication Process

### 1. Final Verification

```bash
# Clean build
rm -rf dist node_modules
npm install
npm run build

# Final validation
npm run validate:package
npm pack --dry-run  # Check what gets included
```

- [ ] **Clean install and build successful**
- [ ] **Package contents verified**
- [ ] **No unexpected files in package**

### 2. Git Preparation

```bash
# Commit all changes
git add .
git commit -m "chore(release): Prepare for version X.X.X"

# Create release tag
git tag vX.X.X
```

- [ ] **All changes committed**
- [ ] **Release tag created**
- [ ] **Working directory clean**

### 3. NPM Publication

```bash
# Publish to npm
npm publish

# Verify publication
npm view woaru version
npm view woaru files
```

- [ ] **Publication successful**
- [ ] **Version visible on npm**
- [ ] **Files list correct on npm**

### 4. Post-Publication Verification

```bash
# Test published package (wait 5-10 minutes for npm propagation)
npx clear-npx-cache
npx woaru@latest --version
```

- [ ] **Latest version installs correctly**
- [ ] **CLI works immediately after install**
- [ ] **No missing files errors**

## 🚨 Rollback Procedure

If issues are discovered after release:

### Immediate Actions
1. **Unpublish if within 24 hours**: `npm unpublish woaru@X.X.X`
2. **Or deprecate version**: `npm deprecate woaru@X.X.X "Version has critical issues, use X.X.Y instead"`

### Fix and Re-release
1. **Fix the issue immediately**
2. **Increment patch version**
3. **Re-run full release checklist**
4. **Publish fixed version**

## 📋 Common Release Issues

### "Failed to start supervisor"
- **Cause**: Missing `tools/` directory
- **Fix**: Verify `tools/` in package.json files array and copy-assets.js

### ES Module Import Errors  
- **Cause**: Missing .js extensions or __dirname issues
- **Fix**: Run `npm run build:fix-esm`

### "Templates not found"
- **Cause**: Missing `templates/` directory
- **Fix**: Verify templates copying in build process

### Package Size Too Large
- **Cause**: Including unnecessary files
- **Fix**: Review package.json files array and .npmignore

## 🔧 Release Automation

### GitHub Actions (Optional)
Consider setting up automated testing:

```yaml
# .github/workflows/release.yml
name: Release Testing
on:
  push:
    tags: ['v*']
jobs:
  test-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npm run validate:package
      - run: npm pack
      - run: npm install -g woaru-*.tgz
      - run: woaru --version
```

## 📞 Emergency Contacts

### Critical Issues
- **Package doesn't work**: Immediate unpublish/deprecate
- **Security vulnerability**: Follow npm security advisory process
- **Breaking changes**: Clearly document and consider major version bump

### Support Channels
- **GitHub Issues**: Bug reports and user issues
- **GitHub Discussions**: Community questions
- **npm Support**: Package-related technical issues

---

## ✅ Final Release Checklist

Before marking release as complete:

- [ ] **NPM package published successfully**
- [ ] **Git tag pushed to repository**
- [ ] **GitHub release created with notes**
- [ ] **CHANGELOG.md reflects new version**
- [ ] **Documentation updated**
- [ ] **Community notified (if major release)**
- [ ] **Post-release monitoring for 24 hours**

**Remember**: A broken npm package affects all users immediately. Take time to verify everything works perfectly!

---

*Last updated: Version 5.3.0*