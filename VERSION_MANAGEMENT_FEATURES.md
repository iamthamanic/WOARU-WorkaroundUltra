# 🚀 WOARU Version Management Features

## 📋 Übersicht

WOARU verfügt jetzt über ein umfassendes Versions- und Update-Management-System mit proaktiven Startup-Checks für eine professionelle Benutzererfahrung.

## 🔧 Neue Befehle

### 1. `woaru version`
Zeigt die aktuell installierte Version von WOARU an.

```bash
woaru version
# Output: WOARU Version: 3.7.1
```

### 2. `woaru version check`
Prüft, ob eine neue Version auf NPM verfügbar ist.

```bash
woaru version check
# Output: 
# 🔍 Checking for updates...
# ✅ Du verwendest die aktuellste Version (v3.7.1)
# 
# ODER
# 
# 📦 Eine neue Version (v3.8.0) ist verfügbar!
#    Veröffentlicht am: 16.07.2025
#    Führe `woaru update` aus, um zu aktualisieren.
```

### 3. `woaru update`
Aktualisiert WOARU auf die neueste Version.

```bash
woaru update
# Output:
# 🚀 Updating WOARU to latest version...
# [npm install output]
# ✅ Update erfolgreich abgeschlossen!
```

## 🔄 Proaktive Startup-Checks

### Automatische Versionsprüfung
- **Caching**: Prüft nur einmal alle 24 Stunden
- **Interaktive Updates**: Fragt bei verfügbaren Updates nach
- **Stille Checks**: Blockiert nicht den normalen Programmstart

### Environment-Checks
WOARU prüft beim Start automatisch die Verfügbarkeit wichtiger Tools:

#### ✅ **Erforderliche Tools**
- **Git**: Kritisch für `woaru review git` und andere Git-basierte Befehle
  - Fehlermeldung: `⚠️ WARNUNG: Git wurde nicht in deinem System gefunden`

#### 💡 **Optionale Tools**
- **Docker**: Für Containerisierung-Checks
- **Snyk**: Für erweiterte Security-Analysen

## 🏗️ Technische Implementation

### Neue Dateien
- `src/utils/versionManager.ts` - Versionsverwaltung
- `src/utils/startupCheck.ts` - Startup-Validierung

### Neue Features
- **Caching-System**: `~/.woaru/startup-cache.json`
- **NPM Registry Integration**: Live-Versionsprüfung
- **Prozess-Management**: Sicheres Update-Handling
- **Interaktive Prompts**: Benutzerfreundliche Update-Dialoge

## 💻 Beispiel-Workflow

```bash
# Normale Verwendung
woaru analyze

# Hinweise werden automatisch angezeigt:
# 📋 Hinweise:
#    💡 Eine neue Version von WOARU (v3.8.0) ist verfügbar. Führe 'woaru update' aus.
#    💡 TIPP: Docker ist nicht verfügbar. Containerisierung-Checks werden übersprungen.

# Manuelle Versionsprüfung
woaru version check

# Update ausführen
woaru update
```

## 🛡️ Sicherheitsfeatures

### Sichere Updates
- **Prozess-Isolation**: Updates laufen in separaten Kindprozessen
- **Fehlerbehandlung**: Robuste Error-Recovery
- **Benutzer-Kontrolle**: Keine automatischen Updates ohne Zustimmung

### Caching-Sicherheit
- **Lokale Speicherung**: Cache nur in `~/.woaru/`
- **Zeitbasierte Invalidierung**: 24-Stunden-Cycle
- **Fallback-Mechanismen**: Funktioniert auch ohne Cache

## 🎯 Vorteile

### Für Entwickler
- **Transparenz**: Klare Versionsinformationen
- **Kontrolle**: Selbstbestimmte Update-Entscheidungen
- **Effizienz**: Automatische Umgebungsprüfungen

### Für Teams
- **Konsistenz**: Einheitliche Versions-Standards
- **Wartbarkeit**: Proaktive Problem-Erkennung
- **Produktivität**: Weniger Setup-Probleme

## 📊 Monitoring

Das System protokolliert:
- **Update-Versuche**: Erfolg/Fehler-Status
- **Umgebungsprüfungen**: Verfügbare/fehlende Tools
- **Cache-Performance**: Optimierte Netzwerk-Zugriffe

---

**Diese Features machen WOARU zu einem professionellen Enterprise-Tool mit automatischer Wartung und proaktiver Problemvermeidung.**