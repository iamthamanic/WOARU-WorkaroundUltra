import { BaseAction } from './BaseAction';
import { PrettierAction } from './PrettierAction';
import { EslintAction } from './EslintAction';
import { HuskyAction } from './HuskyAction';
import { SetupRecommendation, SetupOptions } from '../types';
import chalk from 'chalk';

export class ActionManager {
  private actions: Map<string, BaseAction> = new Map();

  constructor() {
    this.registerAction(new PrettierAction());
    this.registerAction(new EslintAction());
    this.registerAction(new HuskyAction());
  }

  private registerAction(action: BaseAction): void {
    this.actions.set(action.name, action);
  }

  async executeRecommendations(
    projectPath: string,
    recommendations: SetupRecommendation[],
    options: SetupOptions
  ): Promise<{
    success: boolean;
    results: Array<{ tool: string; success: boolean; error?: string }>;
  }> {
    const results: Array<{ tool: string; success: boolean; error?: string }> =
      [];
    let overallSuccess = true;

    console.log(chalk.blue('🚀 Starting WAU setup process...\n'));

    for (const recommendation of recommendations) {
      const action = this.actions.get(recommendation.tool);

      if (!action) {
        console.log(
          chalk.yellow(
            `⚠️  No action available for tool: ${recommendation.tool}`
          )
        );
        results.push({
          tool: recommendation.tool,
          success: false,
          error: 'No action available',
        });
        continue;
      }

      try {
        console.log(chalk.cyan(`📦 Setting up ${recommendation.tool}...`));
        console.log(chalk.gray(`   ${recommendation.reason}`));

        const canExecute = await action.canExecute(projectPath);

        if (!canExecute && !options.force) {
          console.log(
            chalk.gray(
              `⏭️  Skipping ${recommendation.tool} (already configured)`
            )
          );
          results.push({ tool: recommendation.tool, success: true });
          continue;
        }

        const success = await action.execute(projectPath, options);

        if (success) {
          console.log(
            chalk.green(`✅ ${recommendation.tool} setup completed\n`)
          );
        } else {
          console.log(chalk.red(`❌ ${recommendation.tool} setup failed\n`));
          overallSuccess = false;
        }

        results.push({ tool: recommendation.tool, success });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.log(
          chalk.red(`❌ ${recommendation.tool} setup failed: ${errorMessage}\n`)
        );

        results.push({
          tool: recommendation.tool,
          success: false,
          error: errorMessage,
        });
        overallSuccess = false;
      }
    }

    // Summary
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log(chalk.blue('📊 Setup Summary:'));
    console.log(chalk.green(`✅ Successful: ${successCount}/${totalCount}`));

    if (successCount < totalCount) {
      console.log(
        chalk.red(`❌ Failed: ${totalCount - successCount}/${totalCount}`)
      );
    }

    return { success: overallSuccess, results };
  }

  async rollbackTool(projectPath: string, toolName: string): Promise<boolean> {
    const action = this.actions.get(toolName);

    if (!action) {
      console.log(chalk.red(`❌ No action available for tool: ${toolName}`));
      return false;
    }

    try {
      console.log(chalk.yellow(`🔄 Rolling back ${toolName}...`));
      const success = await action.rollback(projectPath);

      if (success) {
        console.log(chalk.green(`✅ ${toolName} rollback completed`));
      } else {
        console.log(chalk.red(`❌ ${toolName} rollback failed`));
      }

      return success;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.log(chalk.red(`❌ ${toolName} rollback failed: ${errorMessage}`));
      return false;
    }
  }

  getAvailableActions(): string[] {
    return Array.from(this.actions.keys());
  }
}
