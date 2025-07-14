/**
 * TypeScript/JavaScript Parser für SOLID-Analyse
 * Verwendet einfache Regex-basierte Parsing für Quick Win Implementation
 */

import * as fs from 'fs-extra';
import { ClassAnalysis, MethodAnalysis } from '../types/solid-types';

export class TypeScriptParser {
  
  /**
   * Analysiert eine TypeScript/JavaScript-Datei und extrahiert Klassen-Informationen
   */
  async parseFile(filePath: string): Promise<{
    classes: ClassAnalysis[];
    imports: string[];
    totalLines: number;
  }> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    return {
      classes: this.extractClasses(content, lines),
      imports: this.extractImports(lines),
      totalLines: lines.length
    };
  }

  /**
   * Extrahiert alle Klassen aus dem Code
   */
  private extractClasses(content: string, lines: string[]): ClassAnalysis[] {
    const classes: ClassAnalysis[] = [];
    
    // Regex für Klassen-Deklarationen (class, export class, abstract class)
    const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const classStartIndex = match.index;
      
      // Finde die Zeile der Klassen-Deklaration
      const lineNumber = this.getLineNumber(content, classStartIndex);
      
      // Extrahiere die gesamte Klasse (von { bis })
      const classContent = this.extractClassContent(content, classStartIndex);
      
      if (classContent) {
        const methods = this.extractMethods(classContent);
        const classLines = classContent.split('\n');
        
        classes.push({
          name: className,
          line: lineNumber,
          methods: methods,
          imports: [], // Wird später gefüllt
          complexity: this.calculateClassComplexity(classContent),
          linesOfCode: classLines.length,
          concerns: [] // Wird später gefüllt
        });
      }
    }
    
    return classes;
  }

  /**
   * Extrahiert alle Import-Statements
   */
  private extractImports(lines: string[]): string[] {
    const imports: string[] = [];
    
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Standard imports: import ... from '...'
      const importMatch = trimmed.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/);
      if (importMatch) {
        imports.push(importMatch[1]);
        return;
      }
      
      // Require statements: require('...')
      const requireMatch = trimmed.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
      if (requireMatch) {
        imports.push(requireMatch[1]);
        return;
      }
      
      // Dynamic imports: import('...')
      const dynamicImportMatch = trimmed.match(/import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
      if (dynamicImportMatch) {
        imports.push(dynamicImportMatch[1]);
      }
    });
    
    return imports;
  }

  /**
   * Extrahiert alle Methoden einer Klasse
   */
  private extractMethods(classContent: string): MethodAnalysis[] {
    const methods: MethodAnalysis[] = [];
    
    // Regex für Methoden (public/private/protected, async, static, etc.)
    const methodRegex = /(?:(?:public|private|protected)\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g;
    let match;
    
    while ((match = methodRegex.exec(classContent)) !== null) {
      const methodName = match[1];
      
      // Skip constructor and getter/setter patterns
      if (methodName === 'constructor' || methodName === 'get' || methodName === 'set') {
        continue;
      }
      
      const methodStartIndex = match.index;
      const lineNumber = this.getLineNumber(classContent, methodStartIndex);
      
      // Extrahiere Parameter-Anzahl
      const paramMatch = match[0].match(/\(([^)]*)\)/);
      const paramCount = paramMatch ? this.countParameters(paramMatch[1]) : 0;
      
      // Extrahiere Methoden-Content für Komplexität
      const methodContent = this.extractMethodContent(classContent, methodStartIndex);
      
      methods.push({
        name: methodName,
        line: lineNumber,
        parameters: paramCount,
        complexity: this.calculateMethodComplexity(methodContent),
        linesOfCode: methodContent.split('\n').length
      });
    }
    
    return methods;
  }

  /**
   * Berechnet die Zeilen-Nummer basierend auf dem Index im String
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Extrahiert den Inhalt einer Klasse (von öffnender bis schließender Klammer)
   */
  private extractClassContent(content: string, startIndex: number): string {
    let braceCount = 0;
    let inClass = false;
    let classStart = -1;
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        if (!inClass) {
          inClass = true;
          classStart = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        
        if (inClass && braceCount === 0) {
          return content.substring(classStart, i + 1);
        }
      }
    }
    
    return '';
  }

  /**
   * Extrahiert den Inhalt einer Methode
   */
  private extractMethodContent(classContent: string, methodStartIndex: number): string {
    let braceCount = 0;
    let inMethod = false;
    let methodStart = -1;
    
    for (let i = methodStartIndex; i < classContent.length; i++) {
      const char = classContent[i];
      
      if (char === '{') {
        if (!inMethod) {
          inMethod = true;
          methodStart = i;
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        
        if (inMethod && braceCount === 0) {
          return classContent.substring(methodStart, i + 1);
        }
      }
    }
    
    return '';
  }

  /**
   * Zählt Parameter in einem Parameter-String
   */
  private countParameters(paramString: string): number {
    if (!paramString.trim()) return 0;
    
    // Einfache Zählung - trennt bei Kommas (nicht perfekt, aber gut für MVP)
    return paramString.split(',').filter(p => p.trim()).length;
  }

  /**
   * Berechnet eine einfache Komplexitäts-Metrik für eine Klasse
   */
  private calculateClassComplexity(classContent: string): number {
    let complexity = 1; // Base complexity
    
    // Zähle Kontroll-Strukturen
    const controlStructures = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\&\&/g,
      /\|\|/g,
      /\?.*:/g // Ternary operators
    ];
    
    controlStructures.forEach(regex => {
      const matches = classContent.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  /**
   * Berechnet eine einfache Komplexitäts-Metrik für eine Methode
   */
  private calculateMethodComplexity(methodContent: string): number {
    let complexity = 1; // Base complexity
    
    // Zähle Kontroll-Strukturen (gleiche Logik wie bei Klassen)
    const controlStructures = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\&\&/g,
      /\|\|/g,
      /\?.*:/g
    ];
    
    controlStructures.forEach(regex => {
      const matches = methodContent.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }
}