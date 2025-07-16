# UI Snapshots v4.7.0 - Multi-AI Review Control Center
**Multi-AI Review Control Center - Advanced AI Provider Management (v4.7.0)**

## AI Control Center Dashboard
**Command:** `npx woaru ai`

```
🤖 WOARU AI Control Center
════════════════════════════════════════════════════════════════

📊 Current Status:
   3 configured | 2 enabled
   • anthropic (claude-4-opus-20250115) - ✅ enabled | 🔑 API-Key gefunden
   • deepseek (deepseek-coder) - ✅ enabled | 🔑 API-Key gefunden
   • openai (gpt-4.1) - ❌ disabled | 🔑 API-Key gefunden

🔄 Review Configuration:
   ✅ Multi-AI Review aktiviert
   🎯 Primärer Provider: anthropic
```

### Dashboard Menu Options
- 🔧 Provider hinzufügen/bearbeiten
- ✅ Multi-AI Review aktivieren
- 🎯 Primäres Review-Modell auswählen
- 🚪 Beenden

## Multi-AI Review Configuration States

### State 1: Multi-AI Review Enabled
```
🔄 Review Configuration:
   ✅ Multi-AI Review aktiviert
   📊 Alle 2 aktivierten Provider werden kontaktiert
```

### State 2: Single-AI Review Mode
```
🔄 Review Configuration:
   ❌ Multi-AI Review deaktiviert
   🎯 Primärer Provider: anthropic
```

### State 3: Configuration Warning
```
🔄 Review Configuration:
   ❌ Multi-AI Review deaktiviert
   ⚠️  Kein primärer Provider ausgewählt!
```

## Primary Provider Selection
**Menu Option:** 🎯 Primäres Review-Modell auswählen

```
🎯 Primäres Review-Modell auswählen
════════════════════════════════════════════════════════════════

Wähle den primären AI-Provider für Single-AI Review Mode:
❯ anthropic (claude-4-opus-20250115) 🔑
  deepseek (deepseek-coder) 🔑
  openai (gpt-4.1) 🔑
```

## Enhanced Setup with Multi-AI Onboarding
**During setup process:**

```
🎯 Multi-AI Review Konfiguration
════════════════════════════════════════════════════════════════

WOARU kann mehrere AI-Provider parallel kontaktieren für umfassende Code-Analyse.

📊 Optionen:
   🔄 Multi-AI Review: Alle Provider kontaktieren (umfassend, höhere Kosten)
   🎯 Single-AI Review: Nur einen Provider kontaktieren (schnell, kostengünstig)

❯ Multi-AI Review aktivieren (empfohlen)
  Single-AI Review verwenden
```

## Configuration Loading Messages
**During AI review analysis:**

```
📄 Loading AI config from: /Users/user/.woaru/config/ai_config.json
🔄 Multi-AI Review mode: All configured providers will be contacted
🧠 Kontaktiere 2 AI-Provider für Analyse: anthropic (claude-4-opus-20250115), deepseek (deepseek-coder)
```

**Or in Single-AI mode:**

```
📄 Loading AI config from: /Users/user/.woaru/config/ai_config.json
🎯 Single-AI Review mode: Only anthropic will be contacted
🧠 Kontaktiere 1 AI-Provider für Analyse: anthropic (claude-4-opus-20250115)
```

## Provider Status Indicators
- ✅ **enabled** - Provider is active and will be contacted
- ❌ **disabled** - Provider is configured but not active
- 🔑 **API-Key gefunden** - API key is properly configured
- ❌ **API-Key fehlt** - API key is missing or invalid
- 🎯 **Primärer Provider** - Selected as primary for Single-AI mode

This release introduces comprehensive AI provider management with intuitive visual feedback and flexible configuration options for different use cases.