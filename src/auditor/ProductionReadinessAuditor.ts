import * as path from 'path';
import * as fs from 'fs-extra';
import { PackageJson } from '../types';

export interface ProductionAudit {
  category: 'error-monitoring' | 'testing' | 'containerization' | 'security' | 'config';
  check: string;
  status: 'missing' | 'found' | 'partial';
  priority: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  recommendation: string;
  packages?: string[];
  files?: string[];
}

export interface AuditConfig {
  language: string;
  frameworks: string[];
  projectType: 'frontend' | 'backend' | 'fullstack' | 'library' | 'cli';
}

export class ProductionReadinessAuditor {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async auditProject(config: AuditConfig): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    // Run all audit categories
    audits.push(...await this.auditErrorMonitoring(config));
    audits.push(...await this.auditTestingFramework(config));
    audits.push(...await this.auditContainerization(config));
    audits.push(...await this.auditSecurity(config));
    audits.push(...await this.auditEnvironmentConfig(config));

    return audits.filter(audit => audit.status === 'missing' || audit.status === 'partial');
  }

  private async auditErrorMonitoring(config: AuditConfig): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    if (config.language === 'javascript' || config.language === 'typescript') {
      const packageJson = await this.readPackageJson();
      if (!packageJson) return audits;

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Check for Sentry
      const sentryPackages = ['@sentry/node', '@sentry/react', '@sentry/browser', '@sentry/nextjs'];
      const hasSentry = sentryPackages.some(pkg => allDeps[pkg]);

      if (!hasSentry) {
        audits.push({
          category: 'error-monitoring',
          check: 'sentry',
          status: 'missing',
          priority: config.projectType === 'library' ? 'low' : 'high',
          message: '💡 PRO-TIPP: Kein Error-Monitoring gefunden',
          recommendation: 'Installiere Sentry für Production-Error-Tracking. Für React: npm install @sentry/react, für Node.js: npm install @sentry/node',
          packages: this.getSentryPackageForFramework(config.frameworks)
        });
      }

      // Check for other error monitoring tools
      const otherErrorTools = ['rollbar', 'bugsnag', 'airbrake'];
      const hasOtherErrorTool = otherErrorTools.some(tool => allDeps[tool]);

      if (!hasSentry && !hasOtherErrorTool) {
        audits.push({
          category: 'error-monitoring',
          check: 'error-tracking',
          status: 'missing',
          priority: 'high',
          message: '⚠️ WARNUNG: Kein Error-Tracking-Tool gefunden',
          recommendation: 'Error-Monitoring ist essentiell für Production-Apps. Erwäge Sentry, Rollbar oder Bugsnag.',
          packages: ['@sentry/node', 'rollbar', 'bugsnag']
        });
      }
    }

    if (config.language === 'python') {
      // Check for Python error monitoring
      const requirementFiles = ['requirements.txt', 'pyproject.toml', 'Pipfile'];
      let hasPythonErrorTracking = false;

      for (const file of requirementFiles) {
        const filePath = path.join(this.projectPath, file);
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          if (content.includes('sentry-sdk') || content.includes('rollbar') || content.includes('bugsnag')) {
            hasPythonErrorTracking = true;
            break;
          }
        }
      }

      if (!hasPythonErrorTracking) {
        audits.push({
          category: 'error-monitoring',
          check: 'python-error-tracking',
          status: 'missing',
          priority: 'high',
          message: '💡 PRO-TIPP: Kein Error-Monitoring für Python gefunden',
          recommendation: 'Installiere sentry-sdk: pip install sentry-sdk',
          packages: ['sentry-sdk']
        });
      }
    }

    return audits;
  }

  private async auditTestingFramework(config: AuditConfig): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    if (config.language === 'javascript' || config.language === 'typescript') {
      const packageJson = await this.readPackageJson();
      if (!packageJson) return audits;

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      const testingFrameworks = ['jest', 'vitest', 'mocha', 'jasmine', 'cypress', 'playwright', '@testing-library/react'];
      const hasTestingFramework = testingFrameworks.some(framework => allDeps[framework]);

      if (!hasTestingFramework) {
        audits.push({
          category: 'testing',
          check: 'testing-framework',
          status: 'missing',
          priority: config.projectType === 'library' ? 'critical' : 'high',
          message: '⚠️ WARNUNG: Kein Testing-Framework gefunden',
          recommendation: 'Tests sind essentiell für Code-Qualität. Für React: npm install --save-dev jest @testing-library/react, für allgemein: npm install --save-dev vitest',
          packages: ['jest', 'vitest', '@testing-library/react']
        });
      }

      // Check for test scripts
      const hasTestScript = packageJson.scripts && (
        packageJson.scripts.test || 
        packageJson.scripts['test:unit'] || 
        packageJson.scripts['test:e2e']
      );

      if (hasTestingFramework && !hasTestScript) {
        audits.push({
          category: 'testing',
          check: 'test-scripts',
          status: 'partial',
          priority: 'medium',
          message: 'Testing-Framework gefunden, aber keine Test-Scripts in package.json',
          recommendation: 'Füge Test-Scripts hinzu: "test": "jest" oder "test": "vitest"'
        });
      }
    }

    if (config.language === 'python') {
      const requirementFiles = ['requirements.txt', 'pyproject.toml', 'Pipfile'];
      let hasPythonTesting = false;

      for (const file of requirementFiles) {
        const filePath = path.join(this.projectPath, file);
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf-8');
          if (content.includes('pytest') || content.includes('unittest') || content.includes('nose')) {
            hasPythonTesting = true;
            break;
          }
        }
      }

      if (!hasPythonTesting) {
        audits.push({
          category: 'testing',
          check: 'python-testing',
          status: 'missing',
          priority: 'high',
          message: '⚠️ WARNUNG: Kein Testing-Framework für Python gefunden',
          recommendation: 'Installiere pytest: pip install pytest',
          packages: ['pytest']
        });
      }
    }

    return audits;
  }

  private async auditContainerization(config: AuditConfig): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    const dockerfilePath = path.join(this.projectPath, 'Dockerfile');
    const hasDockerfile = await fs.pathExists(dockerfilePath);

    if (!hasDockerfile && config.projectType !== 'library') {
      audits.push({
        category: 'containerization',
        check: 'dockerfile',
        status: 'missing',
        priority: 'medium',
        message: '🐳 Kein Dockerfile gefunden',
        recommendation: 'Containerisierung vereinfacht Deployment und Skalierung. Erstelle ein Dockerfile für konsistente Deployments.',
        files: ['Dockerfile']
      });
    }

    const dockerIgnorePath = path.join(this.projectPath, '.dockerignore');
    const hasDockerIgnore = await fs.pathExists(dockerIgnorePath);

    if (hasDockerfile && !hasDockerIgnore) {
      audits.push({
        category: 'containerization',
        check: 'dockerignore',
        status: 'partial',
        priority: 'low',
        message: 'Dockerfile gefunden, aber keine .dockerignore',
        recommendation: 'Erstelle .dockerignore um Build-Performance zu verbessern und Image-Größe zu reduzieren.',
        files: ['.dockerignore']
      });
    }

    return audits;
  }

  private async auditSecurity(config: AuditConfig): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    if (config.language === 'javascript' || config.language === 'typescript') {
      const packageJson = await this.readPackageJson();
      if (!packageJson) return audits;

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Check for helmet (Express security)
      if (allDeps.express && !allDeps.helmet) {
        audits.push({
          category: 'security',
          check: 'helmet',
          status: 'missing',
          priority: 'high',
          message: '🔒 Express ohne Helmet-Schutz',
          recommendation: 'Installiere Helmet für sichere HTTP-Headers: npm install helmet',
          packages: ['helmet']
        });
      }

      // Check for HTTPS enforcement
      const hasHttpsEnforcement = allDeps['express-enforces-ssl'] || allDeps['express-sslify'];
      
      if (allDeps.express && !hasHttpsEnforcement && config.projectType === 'backend') {
        audits.push({
          category: 'security',
          check: 'https-enforcement',
          status: 'missing',
          priority: 'high',
          message: '🔒 Keine HTTPS-Enforcement gefunden',
          recommendation: 'Erzwinge HTTPS in Production: npm install express-enforces-ssl',
          packages: ['express-enforces-ssl']
        });
      }
    }

    return audits;
  }

  private async auditEnvironmentConfig(config: AuditConfig): Promise<ProductionAudit[]> {
    const audits: ProductionAudit[] = [];

    const envExamplePath = path.join(this.projectPath, '.env.example');
    const envPath = path.join(this.projectPath, '.env');
    
    const hasEnvExample = await fs.pathExists(envExamplePath);
    const hasEnv = await fs.pathExists(envPath);

    if (hasEnv && !hasEnvExample) {
      audits.push({
        category: 'config',
        check: 'env-example',
        status: 'missing',
        priority: 'medium',
        message: '.env gefunden, aber keine .env.example',
        recommendation: 'Erstelle .env.example für Team-Kollaboration und Setup-Dokumentation.',
        files: ['.env.example']
      });
    }

    if (config.language === 'javascript' || config.language === 'typescript') {
      const packageJson = await this.readPackageJson();
      if (packageJson?.dependencies?.dotenv && !hasEnv && !hasEnvExample) {
        audits.push({
          category: 'config',
          check: 'env-config',
          status: 'partial',
          priority: 'medium',
          message: 'dotenv installiert, aber keine .env-Dateien gefunden',
          recommendation: 'Erstelle .env für lokale Konfiguration und .env.example als Template.',
          files: ['.env', '.env.example']
        });
      }
    }

    return audits;
  }

  private getSentryPackageForFramework(frameworks: string[]): string[] {
    if (frameworks.includes('next')) return ['@sentry/nextjs'];
    if (frameworks.includes('react')) return ['@sentry/react'];
    if (frameworks.includes('vue')) return ['@sentry/vue'];
    if (frameworks.includes('express')) return ['@sentry/node'];
    return ['@sentry/browser'];
  }

  private async readPackageJson(): Promise<PackageJson | null> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const content = await fs.readJson(packageJsonPath);
      return content as PackageJson;
    } catch {
      return null;
    }
  }
}