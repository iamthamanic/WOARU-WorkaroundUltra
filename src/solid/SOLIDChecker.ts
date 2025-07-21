/**
 * SOLID Checker - Hauptklasse für SOLID-Prinzipien-Analyse
 * Koordiniert alle SOLID-Prinzipien-Checker und erstellt Gesamtberichte
 */

// Removed unused path import
import { BaseSOLIDChecker } from './principles/BaseSOLIDChecker';
import { SRPChecker } from './principles/SRPChecker';
import {
  SOLIDCheckResult,
  SOLIDViolation,
  ProjectSOLIDResult,
  SOLIDPrinciple,
} from './types/solid-types';

export class SOLIDChecker {
  private checkers: Map<SOLIDPrinciple, BaseSOLIDChecker>;

  constructor() {
    this.checkers = new Map([
      ['SRP', new SRPChecker()],
      // Weitere Checker werden in Phase 2B hinzugefügt:
      // ['OCP', new OCPChecker()],
      // ['ISP', new ISPChecker()],
      // ['DIP', new DIPChecker()]
    ]);
  }

  /**
   * Analysiert eine einzelne Datei auf SOLID-Verstöße
   */
  async analyzeFile(
    filePath: string,
    language: string
  ): Promise<SOLIDCheckResult> {
    const violations: SOLIDViolation[] = [];

    // Führe alle verfügbaren SOLID-Checker aus
    for (const [principle, checker] of this.checkers) {
      if (checker.supportsLanguage(language)) {
        try {
          const principleViolations = await checker.check(filePath, language);
          violations.push(...principleViolations);
        } catch (error) {
          console.warn(
            `SOLID-Checker: Fehler beim ${principle}-Check für ${filePath}:`,
            error
          );
        }
      }
    }

    // Berechne Metriken
    const metrics = await this.calculateFileMetrics(filePath, violations);

    // Generiere Verbesserungsvorschläge
    const suggestions = this.generateFileSuggestions(violations);

    return {
      filePath,
      language,
      violations,
      metrics,
      suggestions,
    };
  }

  /**
   * Analysiert ein gesamtes Projekt auf SOLID-Verstöße
   */
  async analyzeProject(
    filePaths: string[],
    language: string
  ): Promise<ProjectSOLIDResult> {
    const allViolations: SOLIDViolation[] = [];
    const fileResults: SOLIDCheckResult[] = [];

    // Analysiere alle Dateien
    for (const filePath of filePaths) {
      const result = await this.analyzeFile(filePath, language);
      fileResults.push(result);
      allViolations.push(...result.violations);
    }

    // Gruppiere Verstöße nach Prinzipien
    const principleBreakdown = this.groupViolationsByPrinciple(allViolations);

    // Berechne Gesamt-SOLID-Score
    const overallScore = this.calculateOverallSOLIDScore(fileResults);

    // Generiere Projekt-weite Empfehlungen
    const recommendations = this.generateProjectRecommendations(
      allViolations,
      fileResults
    );

    return {
      totalFiles: filePaths.length,
      totalViolations: allViolations.length,
      overallSOLIDScore: overallScore,
      principleBreakdown,
      srpViolations: allViolations.filter(v => v.principle === 'SRP'),
      ocpViolations: allViolations.filter(v => v.principle === 'OCP'),
      ispViolations: allViolations.filter(v => v.principle === 'ISP'),
      dipViolations: allViolations.filter(v => v.principle === 'DIP'),
      lspViolations: allViolations.filter(v => v.principle === 'LSP'),
      recommendations,
    };
  }

  /**
   * Prüft ob eine Sprache unterstützt wird
   */
  supportsLanguage(language: string): boolean {
    return Array.from(this.checkers.values()).some(checker =>
      checker.supportsLanguage(language)
    );
  }

  /**
   * Gibt verfügbare SOLID-Prinzipien für eine Sprache zurück
   */
  getAvailablePrinciples(language: string): SOLIDPrinciple[] {
    const principles: SOLIDPrinciple[] = [];

    for (const [principle, checker] of this.checkers) {
      if (checker.supportsLanguage(language)) {
        principles.push(principle);
      }
    }

    return principles;
  }

  /**
   * Berechnet Metriken für eine Datei
   */
  private async calculateFileMetrics(
    filePath: string,
    violations: SOLIDViolation[]
  ) {
    // Extrahiere Metriken aus Violations
    const classCount = new Set(violations.map(v => v.class).filter(Boolean))
      .size;
    const methodCount = violations.filter(v => v.method).length;

    const complexities = violations
      .map(v => v.metrics?.complexity)
      .filter((c): c is number => typeof c === 'number');

    const avgComplexity =
      complexities.length > 0
        ? complexities.reduce((a, b) => a + b, 0) / complexities.length
        : 0;

    const maxComplexity =
      complexities.length > 0 ? Math.max(...complexities) : 0;

    // Berechne SOLID-Score (0-100)
    const solidScore = this.calculateFileSOLIDScore(violations);

    // Berechne Concern Diversity
    const allConcerns = violations
      .map(v => v.metrics?.importConcerns)
      .filter(Boolean)
      .flat() as string[];
    const concernDiversity = new Set(allConcerns).size;

    return {
      classCount: Math.max(classCount, 1), // Mindestens 1 wenn Violations vorhanden
      methodCount,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
      maxComplexity,
      solidScore,
      concernDiversity,
    };
  }

  /**
   * Berechnet einen SOLID-Score für eine Datei (0-100)
   */
  private calculateFileSOLIDScore(violations: SOLIDViolation[]): number {
    if (violations.length === 0) return 100;

    // Gewichtung nach Severity
    const severityWeights = {
      critical: 10,
      high: 6,
      medium: 3,
      low: 1,
    };

    const totalPenalty = violations.reduce((penalty, violation) => {
      return penalty + severityWeights[violation.severity];
    }, 0);

    // Score berechnung: Start bei 100, ziehe Penalties ab
    const score = Math.max(0, 100 - totalPenalty);

    return Math.round(score);
  }

  /**
   * Berechnet den Gesamt-SOLID-Score für ein Projekt
   */
  private calculateOverallSOLIDScore(fileResults: SOLIDCheckResult[]): number {
    if (fileResults.length === 0) return 100;

    const totalScore = fileResults.reduce(
      (sum, result) => sum + result.metrics.solidScore,
      0
    );
    return Math.round(totalScore / fileResults.length);
  }

  /**
   * Gruppiert Verstöße nach SOLID-Prinzipien
   */
  private groupViolationsByPrinciple(violations: SOLIDViolation[]): {
    SRP: { violations: number; score: number };
    OCP: { violations: number; score: number };
    LSP: { violations: number; score: number };
    ISP: { violations: number; score: number };
    DIP: { violations: number; score: number };
  } {
    const principles: SOLIDPrinciple[] = ['SRP', 'OCP', 'LSP', 'ISP', 'DIP'];
    const breakdown = {} as {
      SRP: { violations: number; score: number };
      OCP: { violations: number; score: number };
      LSP: { violations: number; score: number };
      ISP: { violations: number; score: number };
      DIP: { violations: number; score: number };
    };

    principles.forEach(principle => {
      const principleViolations = violations.filter(
        v => v.principle === principle
      );
      const score =
        principleViolations.length === 0
          ? 100
          : Math.max(0, 100 - principleViolations.length * 5);

      breakdown[principle] = {
        violations: principleViolations.length,
        score: Math.round(score),
      };
    });

    return breakdown;
  }

  /**
   * Generiert Verbesserungsvorschläge für eine Datei
   */
  private generateFileSuggestions(violations: SOLIDViolation[]): string[] {
    const suggestions = new Set<string>();

    violations.forEach(violation => {
      // Allgemeine Verbesserungsvorschläge basierend auf Prinzip und Severity
      switch (violation.principle) {
        case 'SRP':
          if (
            violation.severity === 'critical' ||
            violation.severity === 'high'
          ) {
            suggestions.add(
              '🔄 Refaktoriere große Klassen in kleinere, fokussierte Einheiten'
            );
            suggestions.add(
              '📦 Separiere verschiedene Concerns in eigene Services'
            );
          }
          if (
            violation.metrics?.methodCount &&
            violation.metrics.methodCount > 20
          ) {
            suggestions.add(
              '🧩 Verwende das Facade Pattern um komplexe Klassen zu vereinfachen'
            );
          }
          break;
      }
    });

    // Fallback-Vorschläge
    if (suggestions.size === 0 && violations.length > 0) {
      suggestions.add(
        '📚 Überprüfe die SOLID-Prinzipien Dokumentation für Verbesserungsideen'
      );
    }

    return Array.from(suggestions);
  }

  /**
   * Generiert Projekt-weite Empfehlungen
   */
  private generateProjectRecommendations(
    violations: SOLIDViolation[],
    fileResults: SOLIDCheckResult[]
  ): string[] {
    const recommendations: string[] = [];

    // Analyse der häufigsten Probleme
    const violationsByPrinciple = this.groupViolationsByPrinciple(violations);

    // SRP-spezifische Empfehlungen
    if (violationsByPrinciple.SRP.violations > 0) {
      recommendations.push(
        `🎯 ${violationsByPrinciple.SRP.violations} SRP-Verstöße gefunden - Fokussiere auf kleinere, kohäsive Klassen`
      );

      const avgScore =
        fileResults.reduce((sum, r) => sum + r.metrics.solidScore, 0) /
        fileResults.length;
      if (avgScore < 70) {
        recommendations.push(
          '🏗️ Führe systematisches Refactoring durch - beginne mit den kritischsten Verstößen'
        );
      }
    }

    // Allgemeine Architektur-Empfehlungen
    const filesWithManyViolations = fileResults.filter(
      r => r.violations.length > 5
    );
    if (filesWithManyViolations.length > 0) {
      recommendations.push(
        `⚠️ ${filesWithManyViolations.length} Dateien mit vielen SOLID-Verstößen - priorisiere diese für Refactoring`
      );
    }

    // Success Cases
    const cleanFiles = fileResults.filter(r => r.violations.length === 0);
    if (cleanFiles.length > 0) {
      recommendations.push(
        `✅ ${cleanFiles.length} Dateien ohne SOLID-Verstöße - verwende diese als Referenz für gute Architektur`
      );
    }

    return recommendations;
  }
}
