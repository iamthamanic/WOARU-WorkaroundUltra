import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import chalk from 'chalk';

export interface PromptTemplate {
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  system_prompt: string;
  user_prompt: string;
  parameters: {
    max_tokens: number;
    temperature: number;
    focus_areas: string[];
  };
  output_format: {
    structure: string;
    sections: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * PromptManager - Manages dynamic prompt templates for LLM analysis
 *
 * Features:
 * - Load and manage prompt templates from YAML files
 * - Copy standard templates during LLM setup
 * - Dynamic prompt loading based on user selection
 * - Template validation and error handling
 */
export class PromptManager {
  private static instance: PromptManager;
  private readonly woaruDir: string;
  private readonly promptsDir: string;
  private readonly templatesDir: string;

  private constructor() {
    this.woaruDir = path.join(os.homedir(), '.woaru');
    this.promptsDir = path.join(this.woaruDir, 'config', 'woaru_llm_prompts');
    // Use __dirname to get the installation directory, not the current working directory
    this.templatesDir = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'prompts'
    );
  }

  /**
   * Get singleton instance of PromptManager
   */
  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  /**
   * Initialize prompt directories
   */
  public async initialize(): Promise<void> {
    try {
      await fs.ensureDir(this.promptsDir);
      console.log(`✅ Prompt directory initialized: ${this.promptsDir}`);
    } catch (error) {
      console.error(`❌ Failed to initialize prompt directory: ${error}`);
      throw error;
    }
  }

  /**
   * Copy standard prompt templates for a specific LLM provider
   */
  public async copyStandardPrompts(providerId: string): Promise<void> {
    try {
      const providerPromptsDir = path.join(this.promptsDir, providerId);
      await fs.ensureDir(providerPromptsDir);

      // Check if templates directory exists
      if (!(await fs.pathExists(this.templatesDir))) {
        console.warn(
          chalk.yellow(`⚠️ Templates directory not found: ${this.templatesDir}`)
        );
        return;
      }

      // Get list of template files
      const templateFiles = await fs.readdir(this.templatesDir);
      const yamlFiles = templateFiles.filter(
        file => file.endsWith('.yaml') || file.endsWith('.yml')
      );

      if (yamlFiles.length === 0) {
        console.warn(chalk.yellow('⚠️ No prompt templates found to copy'));
        return;
      }

      let copiedCount = 0;
      for (const templateFile of yamlFiles) {
        const sourcePath = path.join(this.templatesDir, templateFile);
        const destPath = path.join(providerPromptsDir, templateFile);

        // Only copy if destination doesn't exist (don't overwrite user customizations)
        if (!(await fs.pathExists(destPath))) {
          await fs.copy(sourcePath, destPath);
          copiedCount++;
        }
      }

      if (copiedCount > 0) {
        console.log(
          chalk.green(
            `✅ Copied ${copiedCount} standard prompt templates to ${providerPromptsDir}`
          )
        );
        console.log(
          chalk.cyan(
            `ℹ️  Standard-Prompts wurden nach ~/.woaru/config/woaru_llm_prompts/${providerId}/ kopiert.`
          )
        );
        console.log(
          chalk.cyan(
            `ℹ️  Du kannst diese Dateien bearbeiten, um die AI-Analyse anzupassen.`
          )
        );

        // List available prompts
        const availablePrompts = yamlFiles.map(file =>
          path.basename(file, path.extname(file))
        );
        console.log(
          chalk.gray(`📋 Available prompts: ${availablePrompts.join(', ')}`)
        );
      } else {
        console.log(
          chalk.gray(`ℹ️  All prompt templates already exist for ${providerId}`)
        );
      }
    } catch (error) {
      console.error(chalk.red(`❌ Failed to copy standard prompts: ${error}`));
      throw error;
    }
  }

  /**
   * Load a specific prompt template for a provider
   */
  public async loadPrompt(
    providerId: string,
    promptName: string = 'default_review'
  ): Promise<PromptTemplate> {
    try {
      const promptPath = path.join(
        this.promptsDir,
        providerId,
        `${promptName}.yaml`
      );

      // Check if prompt file exists
      if (!(await fs.pathExists(promptPath))) {
        // Try fallback to global templates
        const fallbackPath = path.join(this.templatesDir, `${promptName}.yaml`);
        if (await fs.pathExists(fallbackPath)) {
          console.log(
            chalk.yellow(`⚠️ Using fallback prompt template: ${fallbackPath}`)
          );
          return await this.loadPromptFile(fallbackPath);
        }

        throw new Error(
          `Prompt template not found: ${promptName} for provider ${providerId}`
        );
      }

      return await this.loadPromptFile(promptPath);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to load prompt template: ${error}`));
      throw error;
    }
  }

  /**
   * Load prompt template from file
   */
  private async loadPromptFile(filePath: string): Promise<PromptTemplate> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const promptTemplate = yaml.load(content) as PromptTemplate;

      // Validate required fields
      if (
        !promptTemplate.name ||
        !promptTemplate.system_prompt ||
        !promptTemplate.user_prompt
      ) {
        throw new Error(
          'Invalid prompt template: missing required fields (name, system_prompt, user_prompt)'
        );
      }

      return promptTemplate;
    } catch (error) {
      throw new Error(`Failed to parse prompt template: ${error}`);
    }
  }

  /**
   * List available prompts for a provider
   */
  public async listAvailablePrompts(providerId: string): Promise<string[]> {
    try {
      const providerPromptsDir = path.join(this.promptsDir, providerId);

      if (!(await fs.pathExists(providerPromptsDir))) {
        return [];
      }

      const files = await fs.readdir(providerPromptsDir);
      return files
        .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'))
        .map(file => path.basename(file, path.extname(file)));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to list prompts: ${error}`));
      return [];
    }
  }

  /**
   * Get prompt directory for a provider
   */
  public getProviderPromptsDir(providerId: string): string {
    return path.join(this.promptsDir, providerId);
  }

  /**
   * Validate prompt template structure
   */
  public validatePromptTemplate(template: unknown): boolean {
    const requiredFields = ['name', 'system_prompt', 'user_prompt'];

    for (const field of requiredFields) {
      if (!(template as Record<string, unknown>)[field]) {
        console.error(
          chalk.red(`❌ Missing required field in prompt template: ${field}`)
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Interpolate variables in prompt text
   */
  public interpolatePrompt(
    promptText: string,
    variables: Record<string, string>
  ): string {
    let interpolated = promptText;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      interpolated = interpolated.replace(regex, value);
    }

    return interpolated;
  }

  /**
   * Create a new prompt template from scratch
   */
  public async createPromptTemplate(
    providerId: string,
    templateData: Partial<PromptTemplate>
  ): Promise<void> {
    try {
      const providerPromptsDir = path.join(this.promptsDir, providerId);
      await fs.ensureDir(providerPromptsDir);

      const fileName = `${templateData.name?.toLowerCase().replace(/\s+/g, '_') || 'custom_prompt'}.yaml`;
      const filePath = path.join(providerPromptsDir, fileName);

      // Create basic template structure if not provided
      const template: PromptTemplate = {
        name: templateData.name || 'Custom Prompt',
        description: templateData.description || 'Custom prompt template',
        version: templateData.version || '1.0.0',
        author: templateData.author || 'User',
        tags: templateData.tags || ['custom'],
        system_prompt:
          templateData.system_prompt || 'You are a helpful AI assistant.',
        user_prompt:
          templateData.user_prompt ||
          'Please analyze the following code:\n\n{code_content}',
        parameters: templateData.parameters || {
          max_tokens: 4000,
          temperature: 0.1,
          focus_areas: ['general'],
        },
        output_format: templateData.output_format || {
          structure: 'markdown',
          sections: ['summary', 'findings'],
          include_line_numbers: true,
        },
      };

      const yamlContent = yaml.dump(template, { indent: 2 });
      await fs.writeFile(filePath, yamlContent, 'utf8');

      console.log(
        chalk.green(`✅ Created custom prompt template: ${filePath}`)
      );
    } catch (error) {
      console.error(chalk.red(`❌ Failed to create prompt template: ${error}`));
      throw error;
    }
  }
}
