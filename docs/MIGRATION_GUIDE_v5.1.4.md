# Migration Guide to WOARU v5.1.4

This guide helps you migrate from WOARU v5.1.3 or earlier to v5.1.4.

## 🚨 Breaking Changes

While v5.1.4 is a patch release with no intentional breaking changes, the migration to ES Modules may affect some edge cases:

### 1. Module System Change

WOARU now uses ES Modules instead of CommonJS. This should be transparent for most users, but if you're importing WOARU programmatically:

**Before (v5.1.3):**
```javascript
const { WOARUEngine } = require('woaru');
```

**After (v5.1.4):**
```javascript
import { WOARUEngine } from 'woaru';
```

### 2. Node.js Version Requirement

While the minimum Node.js version remains 16.0.0, ES Modules work best with Node.js 18+. Consider upgrading if you experience issues.

## ✅ What Stays the Same

- All CLI commands work exactly as before
- Configuration files remain unchanged
- API interfaces are backward compatible
- All features from v5.1.3 are preserved

## 🔄 Migration Steps

### For CLI Users

1. **Update WOARU:**
   ```bash
   npm install -g woaru@5.1.4
   ```

2. **Verify installation:**
   ```bash
   woaru --version
   # Should output: 5.1.4
   ```

3. **Test your workflow:**
   ```bash
   woaru analyze
   woaru commands
   ```

That's it! CLI users don't need any additional changes.

### For Programmatic Users

1. **Update your imports** (if applicable):
   - Change `require()` to `import` statements
   - Or use dynamic imports: `const { WOARUEngine } = await import('woaru');`

2. **Update your package.json** (if using WOARU as a dependency):
   ```json
   {
     "dependencies": {
       "woaru": "^5.1.4"
     }
   }
   ```

3. **If you're using TypeScript:**
   - The type definitions are now more strict
   - You may need to update code that previously used `any` types

## 🎯 Benefits of Upgrading

1. **Better Performance**: ES Modules enable better tree-shaking
2. **Type Safety**: No more `any` types means better IDE support
3. **Cross-Platform**: Build now works on all platforms
4. **Clean Code**: Consistent formatting throughout
5. **Future Proof**: Modern module system ready for the future

## 🆘 Troubleshooting

### Issue: "Cannot use import statement outside a module"

**Solution:** Add `"type": "module"` to your package.json or use `.mjs` file extension.

### Issue: "Module not found" errors

**Solution:** Clear your node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Build fails on Windows

**Solution:** This should be fixed in v5.1.4. If you still experience issues, ensure you have the latest version.

## 📞 Getting Help

If you encounter any issues during migration:

1. Check our [GitHub Issues](https://github.com/iamthamanic/WOARU-WorkaroundUltra/issues)
2. Create a new issue using the v5.1.4 bug report template
3. Include your Node.js version and platform information

## 🎉 Success Stories

After migrating to v5.1.4, you should see:
- Faster build times
- Better error messages from TypeScript
- Consistent code formatting
- No security warnings from npm audit

---

Happy migrating! 🚀