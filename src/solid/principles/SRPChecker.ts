/**
 * Single Responsibility Principle (SRP) Checker
 * Erkennt Klassen und Methoden, die zu viele Verantwortlichkeiten haben
 */

import { BaseSOLIDChecker } from './BaseSOLIDChecker';
import { SOLIDViolation, SOLIDPrinciple } from '../types/solid-types';
import { TypeScriptParser } from '../parsers/TypeScriptParser';

export class SRPChecker extends BaseSOLIDChecker {
  protected principle: SOLIDPrinciple = 'SRP';
  protected supportedLanguages = ['typescript', 'javascript'];
  
  private parser: TypeScriptParser;

  constructor() {
    super();
    this.parser = new TypeScriptParser();
  }

  /**
   * Führt SRP-Analyse für eine Datei durch
   */
  async check(filePath: string, language: string): Promise<SOLIDViolation[]> {
    if (!this.supportsLanguage(language)) {
      return [];
    }

    const violations: SOLIDViolation[] = [];

    try {
      // Parse die Datei
      const analysis = await this.parser.parseFile(filePath);
      
      // Analysiere jede Klasse
      for (const classAnalysis of analysis.classes) {
        // Füge Import-Concerns zur Klassen-Analyse hinzu
        classAnalysis.concerns = this.analyzeImportConcerns(analysis.imports);
        
        // 1. Check für zu viele Methoden (High Method Count)
        violations.push(...this.checkMethodCount(filePath, classAnalysis));
        
        // 2. Check für zu hohe Komplexität
        violations.push(...this.checkComplexity(filePath, classAnalysis));
        
        // 3. Check für zu viele verschiedene Concerns
        violations.push(...this.checkConcernDiversity(filePath, classAnalysis));
        
        // 4. Check für zu große Klassen (Lines of Code)
        violations.push(...this.checkClassSize(filePath, classAnalysis));
        
        // 5. Check für Methoden mit zu vielen Parametern
        violations.push(...this.checkMethodParameters(filePath, classAnalysis));
      }

      // 6. File-Level Check: Zu viele Klassen in einer Datei
      violations.push(...this.checkFileClassCount(filePath, analysis.classes));

    } catch (error) {
      console.warn(`SRP-Checker: Fehler beim Analysieren von ${filePath}:`, error);
    }

    return violations;
  }

  /**
   * Prüft auf zu viele Methoden in einer Klasse
   */
  private checkMethodCount(filePath: string, classAnalysis: any): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const methodCount = classAnalysis.methods.length;

    // Thresholds für Method Count
    const thresholds = { low: 8, medium: 15, high: 25 };
    
    if (methodCount >= thresholds.low) {
      const severity = this.calculateSeverity(methodCount, thresholds);
      
      violations.push(this.createViolation({
        file: filePath,
        line: classAnalysis.line,
        class: classAnalysis.name,
        description: `Klasse ${classAnalysis.name} hat ${methodCount} Methoden`,
        explanation: 'Klassen mit vielen Methoden haben oft mehrere Verantwortlichkeiten. Das Single Responsibility Principle besagt, dass eine Klasse nur einen Grund zur Änderung haben sollte.',
        impact: 'Schwer zu testen, zu verstehen und zu warten. Hohe Wahrscheinlichkeit für Bugs bei Änderungen.',
        suggestion: `Teile die Klasse ${classAnalysis.name} in kleinere, fokussierte Klassen auf. Gruppiere verwandte Methoden in separate Services oder Utility-Klassen.`,
        severity,
        metrics: {
          methodCount: methodCount,
          complexity: classAnalysis.complexity
        }
      }));
    }

    return violations;
  }

  /**
   * Prüft auf zu hohe Klassen-Komplexität
   */
  private checkComplexity(filePath: string, classAnalysis: any): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const complexity = classAnalysis.complexity;

    // Thresholds für Complexity
    const thresholds = { low: 15, medium: 30, high: 50 };
    
    if (complexity >= thresholds.low) {
      const severity = this.calculateSeverity(complexity, thresholds);
      
      violations.push(this.createViolation({
        file: filePath,
        line: classAnalysis.line,
        class: classAnalysis.name,
        description: `Klasse ${classAnalysis.name} hat eine Komplexität von ${complexity}`,
        explanation: 'Hohe zyklomatische Komplexität deutet auf zu viele verschiedene Logik-Pfade in einer Klasse hin, was gegen das SRP verstößt.',
        impact: 'Schwer zu testen (viele Test-Cases nötig), fehleranfällig, schwer zu verstehen.',
        suggestion: `Extrahiere komplexe Logik in separate Methoden oder Klassen. Verwende Design Patterns wie Strategy oder Command um Komplexität zu reduzieren.`,
        severity,
        metrics: {
          complexity: complexity,
          methodCount: classAnalysis.methods.length
        }
      }));
    }

    return violations;
  }

  /**
   * Prüft auf zu viele verschiedene Concerns (Verantwortlichkeiten)
   */
  private checkConcernDiversity(filePath: string, classAnalysis: any): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const concernCount = classAnalysis.concerns.length;

    // Thresholds für Concern Diversity
    const thresholds = { low: 3, medium: 4, high: 6 };
    
    if (concernCount >= thresholds.low) {
      const severity = this.calculateSeverity(concernCount, thresholds);
      
      violations.push(this.createViolation({
        file: filePath,
        line: classAnalysis.line,
        class: classAnalysis.name,
        description: `Klasse ${classAnalysis.name} importiert aus ${concernCount} verschiedenen Bereichen: ${classAnalysis.concerns.join(', ')}`,
        explanation: 'Imports aus verschiedenen Bereichen (Database, HTTP, Filesystem, Email, etc.) deuten darauf hin, dass die Klasse multiple Verantwortlichkeiten hat.',
        impact: 'Hohe Kopplung, schwere Testbarkeit (viele Mocks nötig), Änderungen in einem Bereich können andere beeinflussen.',
        suggestion: `Separiere die verschiedenen Concerns in eigene Services: ${classAnalysis.concerns.map((c: string) => `${c}Service`).join(', ')}. Verwende Dependency Injection um diese Services zu koordinieren.`,
        severity,
        metrics: {
          dependencies: concernCount,
          importConcerns: classAnalysis.concerns
        }
      }));
    }

    return violations;
  }

  /**
   * Prüft auf zu große Klassen (Lines of Code)
   */
  private checkClassSize(filePath: string, classAnalysis: any): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const linesOfCode = classAnalysis.linesOfCode;

    // Thresholds für Class Size
    const thresholds = { low: 100, medium: 200, high: 400 };
    
    if (linesOfCode >= thresholds.low) {
      const severity = this.calculateSeverity(linesOfCode, thresholds);
      
      violations.push(this.createViolation({
        file: filePath,
        line: classAnalysis.line,
        class: classAnalysis.name,
        description: `Klasse ${classAnalysis.name} hat ${linesOfCode} Zeilen Code`,
        explanation: 'Sehr große Klassen sind oft ein Indikator für multiple Verantwortlichkeiten und verletzen das Single Responsibility Principle.',
        impact: 'Schwer zu navigieren, zu verstehen und zu warten. Hohe Wahrscheinlichkeit für Merge-Konflikte.',
        suggestion: `Refaktoriere die Klasse ${classAnalysis.name} in kleinere, kohäsive Einheiten. Identifiziere logische Gruppen von Methoden und extrahiere sie in separate Klassen.`,
        severity,
        metrics: {
          linesOfCode: linesOfCode,
          methodCount: classAnalysis.methods.length
        }
      }));
    }

    return violations;
  }

  /**
   * Prüft auf Methoden mit zu vielen Parametern
   */
  private checkMethodParameters(filePath: string, classAnalysis: any): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    
    classAnalysis.methods.forEach((method: any) => {
      // Thresholds für Parameter Count
      const thresholds = { low: 4, medium: 6, high: 8 };
      
      if (method.parameters >= thresholds.low) {
        const severity = this.calculateSeverity(method.parameters, thresholds);
        
        violations.push(this.createViolation({
          file: filePath,
          line: method.line,
          class: classAnalysis.name,
          method: method.name,
          description: `Methode ${method.name} hat ${method.parameters} Parameter`,
          explanation: 'Methoden mit vielen Parametern deuten oft darauf hin, dass sie zu viele verschiedene Dinge tun und gegen das SRP verstoßen.',
          impact: 'Schwer zu nutzen, fehleranfällig (Parameter-Reihenfolge), schwer zu testen.',
          suggestion: `Fasse verwandte Parameter in ein Objekt zusammen oder teile die Methode ${method.name} in kleinere, spezifischere Methoden auf.`,
          severity,
          metrics: {
            parameters: method.parameters,
            complexity: method.complexity
          }
        }));
      }
    });

    return violations;
  }

  /**
   * Prüft auf zu viele Klassen in einer Datei
   */
  private checkFileClassCount(filePath: string, classes: any[]): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const classCount = classes.length;

    // Thresholds für Class Count per File
    const thresholds = { low: 2, medium: 4, high: 6 };
    
    if (classCount >= thresholds.low) {
      const severity = this.calculateSeverity(classCount, thresholds);
      
      violations.push(this.createViolation({
        file: filePath,
        description: `Datei enthält ${classCount} Klassen: ${classes.map(c => c.name).join(', ')}`,
        explanation: 'Dateien mit vielen Klassen deuten oft darauf hin, dass verwandte aber unterschiedliche Verantwortlichkeiten in einer Datei gemischt werden.',
        impact: 'Schwer zu navigieren, unklare Struktur, Merge-Konflikte wahrscheinlicher.',
        suggestion: `Teile die Datei ${this.getFileName(filePath)} auf: eine Datei pro Klasse oder gruppiere nur wirklich eng verwandte Klassen zusammen.`,
        severity,
        metrics: {
          classCount: classCount
        }
      }));
    }

    return violations;
  }
}