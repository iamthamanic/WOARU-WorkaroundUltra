# 🚀 WOARU Pre-Release Checklist

Diese Checkliste muss vor jedem `npm publish` vollständig abgearbeitet werden, um die Qualitätsprobleme zu vermeiden, die in der Vergangenheit aufgetreten sind.

## 📋 Vorbereitung

### Versioning & Documentation
- [ ] **Versionsnummer korrekt nach SemVer erhöht**
  - [ ] `package.json` version aktualisiert
  - [ ] `src/config/constants.ts` version aktualisiert (falls verwendet)
  - [ ] Version folgt SemVer: MAJOR.MINOR.PATCH
  - [ ] Nach 3.9.0 kommt 4.0.0 (nicht 3.10.0)

- [ ] **README.md vollständig aktualisiert**
  - [ ] Neue Release-Sektion mit korrektem Datum hinzugefügt
  - [ ] Alle neuen Features dokumentiert
  - [ ] Breaking Changes klar markiert
  - [ ] Migration Guide erstellt (falls Breaking Changes)
  - [ ] Beispiele für neue Features hinzugefügt

- [ ] **CHANGELOG.md aktualisiert**
  - [ ] Neue Version mit Datum hinzugefügt
  - [ ] Added: Neue Features
  - [ ] Fixed: Behobene Bugs
  - [ ] Changed: Geänderte Features
  - [ ] Breaking: Breaking Changes

## 🧪 Qualitätssicherung

### Code Quality
- [ ] **TypeScript Compilation erfolgreich**
  ```bash
  npm run build
  ```

- [ ] **Alle Tests bestehen**
  ```bash
  npm test
  ```

- [ ] **Linting ohne Fehler**
  ```bash
  npm run lint
  ```

- [ ] **Code Formatting korrekt**
  ```bash
  npm run format:check
  ```

### Integration Tests
- [ ] **ToolsDatabaseManager Tests**
  - [ ] AI Models Database lädt korrekt von lokaler Datei
  - [ ] Fallback-Mechanismen funktionieren
  - [ ] Fehlerbehandlung für korrupte Dateien
  - [ ] Alle Provider korrekt geladen

- [ ] **Setup LLM Tests**
  - [ ] Interaktive Dialoge funktionieren
  - [ ] Dynamische Modell-Auswahl aus AI Models Database
  - [ ] API-Keys werden korrekt gespeichert
  - [ ] Keine hardcoded Modell-Listen mehr vorhanden

### Manual Testing
- [ ] **Smoke Tests durchgeführt**
  - [ ] `woaru version` zeigt korrekte Version
  - [ ] `woaru analyze` funktioniert in echtem Projekt
  - [ ] `woaru setup llm` zeigt dynamische Modell-Auswahl
  - [ ] `woaru review` funktioniert (falls AI konfiguriert)

## 🎯 Kritische Prüfungen

### Anti-Regression Checks
- [ ] **Keine hardcoded Modell-Listen**
  ```bash
  # Prüfe auf hardcoded Modell-IDs in src/
  grep -r "claude-3-5-sonnet-20241022" src/
  grep -r "gpt-4o" src/
  grep -r "gemini-1.5-pro" src/
  # Sollte keine Treffer in Setup-Funktionen geben
  ```

- [ ] **AI Models Database Integration**
  - [ ] Lokale `ai-models.json` wird priorisiert geladen
  - [ ] Setup-Funktionen nutzen `getAIModelsDatabase()`
  - [ ] Fallback-Mechanismen greifen bei Fehlern

- [ ] **Konfiguration konsistent**
  - [ ] API-Schlüssel werden in `~/.woaru/.env` gespeichert
  - [ ] Konfigurationsdateien werden korrekt generiert
  - [ ] Alle Provider haben einheitliche Struktur

### Performance & Stability
- [ ] **Startup Performance**
  - [ ] Keine blocking Operations beim Start
  - [ ] Graceful Degradation bei Netzwerkfehlern
  - [ ] Startup-Zeit unter 2 Sekunden

- [ ] **Memory Leaks**
  - [ ] Keine unbehandelten Promise rejections
  - [ ] Event Listeners werden korrekt entfernt
  - [ ] Temporäre Dateien werden aufgeräumt

## 📦 Release Process

### Pre-Publish
- [ ] **Branch und Tag vorbereitet**
  - [ ] Release Branch erstellt: `release/vX.Y.Z`
  - [ ] Alle Änderungen committed
  - [ ] Branch in `main` gemerged

- [ ] **Final Build**
  ```bash
  npm run build
  npm test
  ```

### Publish
- [ ] **NPM Publish**
  ```bash
  npm publish
  ```

- [ ] **Git Tag erstellt**
  ```bash
  git tag -a vX.Y.Z -m "Release of version X.Y.Z"
  git push origin vX.Y.Z
  ```

### Post-Publish Verification
- [ ] **Verfügbarkeit prüfen**
  - [ ] NPM-Paket verfügbar: `npm view woaru@X.Y.Z`
  - [ ] Installation funktioniert: `npm install -g woaru@X.Y.Z`
  - [ ] Ausführung funktioniert: `npx woaru@X.Y.Z version`

- [ ] **Funktionalität bestätigen**
  - [ ] Frische Installation funktioniert
  - [ ] Haupt-Features funktionieren
  - [ ] Keine Regression bei bestehenden Features

## 🚨 Notfall-Prozedur

Falls nach dem Release kritische Fehler entdeckt werden:

1. **Sofortmaßnahmen**
   - [ ] Problem identifizieren und dokumentieren
   - [ ] Hotfix-Branch erstellen
   - [ ] Patch-Version erhöhen (X.Y.Z → X.Y.Z+1)

2. **Hotfix-Release**
   - [ ] Fix implementieren
   - [ ] Tests für Fix schreiben
   - [ ] Checkliste erneut abarbeiten
   - [ ] Patch-Release veröffentlichen

## 📝 Lessons Learned

### Vergangene Probleme vermeiden
- **v4.0.0 → v4.1.0**: Hardcoded Modell-Listen trotz Database-System
- **v3.9.0 → v4.0.0**: Versionsnummern-Verwirrung
- **Allgemein**: Premature Release-Kommunikation

### Qualitätssicherung
- Integration Tests sind kritisch für komplexe Features
- Manuelle Tests in echter Umgebung unerlässlich
- Fallback-Mechanismen müssen getestet werden
- Dokumentation muss vor Release aktualisiert werden

---

**⚠️ WICHTIG**: Diese Checkliste MUSS vollständig abgearbeitet werden. Jeder Punkt ist aus realen Problemen entstanden und verhindert Produktionsfehler.

**✅ Bestätigung**: Alle Punkte wurden überprüft und sind erfolgreich abgeschlossen.

**🚀 Release bereit**: Version X.Y.Z kann veröffentlicht werden.

---

*Letzte Aktualisierung: Januar 2025*
*Basierend auf: WOARU Projekt-Audit und Lessons Learned*