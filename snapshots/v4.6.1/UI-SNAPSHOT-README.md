# UI Snapshots v4.6.1 - AI Setup Dialog Bugfixes
**AI Setup Dialog - Fixed Prompt Order (v4.6.1)**

## Provider Selection with Dynamic Status
- ✅ Anthropic Claude (AKTIV: claude-4-opus)
- ❌ OpenAI GPT (NICHT KONFIGURIERT)
- ❌ Google Gemini (NICHT KONFIGURIERT)
- ✅ Fertig & Speichern

## Model Selection (Step 1)
- Claude 4 Opus - Most advanced Claude model
- Claude 4 Sonnet - Balanced performance
- Claude 3.5 Sonnet - Superior coding abilities

## API Key Input (Step 2)
- Validation: API key is required
- Secure input handling

## Provider Activation (Step 3)
- Enable provider for code analysis?
- Default: Yes

## Configuration Migration
- Automatic llm_config.json → ai_config.json
- User notification on migration
- Preserves existing settings

This release fixes the critical prompt order issue and enhances the overall setup experience.
