import { BaseAction } from './BaseAction';
import { PrettierAction } from './PrettierAction';
import { EslintAction } from './EslintAction';
import { HuskyAction } from './HuskyAction';
import { SetupRecommendation, SetupOptions } from '../types';
import chalk from 'chalk';
import {
  triggerHook,
  type BeforeToolExecutionData,
  type AfterToolExecutionData,
  type ErrorHookData,
} from '../core/HookSystem';

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
    const startTime = new Date();
    const results: Array<{ tool: string; success: boolean; error?: string }> =
      [];
    let overallSuccess = true;

    // 🪝 HOOK: beforeToolExecution - KI-freundliche Regelwelt (Batch Setup)
    const batchBeforeData: BeforeToolExecutionData = {
      toolName: 'action-manager-batch',
      filePath: projectPath,
      command: 'execute-recommendations-batch',
      timestamp: startTime,
    };

    try {
      await triggerHook('beforeToolExecution', batchBeforeData);
    } catch (hookError) {
      console.debug(`Hook error (beforeToolExecution batch): ${hookError}`);
    }

    try {
      console.log(chalk.blue('🚀 Starting WOARU setup process...\n'));

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

        const toolStartTime = new Date();

        // 🪝 HOOK: beforeToolExecution - KI-freundliche Regelwelt (Individual Tool)
        const beforeData: BeforeToolExecutionData = {
          toolName: recommendation.tool,
          filePath: projectPath,
          command: 'execute-action',
          timestamp: toolStartTime,
        };

        try {
          await triggerHook('beforeToolExecution', beforeData);
        } catch (hookError) {
          console.debug(
            `Hook error (beforeToolExecution ${recommendation.tool}): ${hookError}`
          );
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

            // 🪝 HOOK: afterToolExecution - KI-freundliche Regelwelt (Skipped Tool)
            const afterSkippedData: AfterToolExecutionData = {
              toolName: recommendation.tool,
              filePath: projectPath,
              command: 'execute-action',
              output: 'Skipped - already configured',
              exitCode: 0,
              success: true,
              duration: new Date().getTime() - toolStartTime.getTime(),
              timestamp: new Date(),
            };

            try {
              await triggerHook('afterToolExecution', afterSkippedData);
            } catch (hookError) {
              console.debug(
                `Hook error (afterToolExecution skipped ${recommendation.tool}): ${hookError}`
              );
            }

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

          // 🪝 HOOK: afterToolExecution - KI-freundliche Regelwelt (Individual Tool)
          const afterData: AfterToolExecutionData = {
            toolName: recommendation.tool,
            filePath: projectPath,
            command: 'execute-action',
            output: success ? 'Setup completed successfully' : 'Setup failed',
            exitCode: success ? 0 : 1,
            success: success,
            duration: new Date().getTime() - toolStartTime.getTime(),
            timestamp: new Date(),
          };

          try {
            await triggerHook('afterToolExecution', afterData);
          } catch (hookError) {
            console.debug(
              `Hook error (afterToolExecution ${recommendation.tool}): ${hookError}`
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.log(
            chalk.red(
              `❌ ${recommendation.tool} setup failed: ${errorMessage}\n`
            )
          );

          results.push({
            tool: recommendation.tool,
            success: false,
            error: errorMessage,
          });
          overallSuccess = false;

          // 🪝 HOOK: onError - KI-freundliche Regelwelt (Individual Tool)
          const errorData: ErrorHookData = {
            error: error instanceof Error ? error : new Error(String(error)),
            context: 'action-execution',
            filePath: projectPath,
            toolName: recommendation.tool,
            timestamp: new Date(),
          };

          try {
            await triggerHook('onError', errorData);
          } catch (hookError) {
            console.debug(
              `Hook error (onError ${recommendation.tool}): ${hookError}`
            );
          }

          // 🪝 HOOK: afterToolExecution - KI-freundliche Regelwelt (Failed Tool)
          const afterErrorData: AfterToolExecutionData = {
            toolName: recommendation.tool,
            filePath: projectPath,
            command: 'execute-action',
            output: `Setup failed: ${errorMessage}`,
            exitCode: 1,
            success: false,
            duration: new Date().getTime() - toolStartTime.getTime(),
            timestamp: new Date(),
          };

          try {
            await triggerHook('afterToolExecution', afterErrorData);
          } catch (hookError) {
            console.debug(
              `Hook error (afterToolExecution error ${recommendation.tool}): ${hookError}`
            );
          }
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

      // 🪝 HOOK: afterToolExecution - KI-freundliche Regelwelt (Batch Complete)
      const batchAfterData: AfterToolExecutionData = {
        toolName: 'action-manager-batch',
        filePath: projectPath,
        command: 'execute-recommendations-batch',
        output: `Processed ${totalCount} recommendations, ${successCount} successful`,
        exitCode: overallSuccess ? 0 : 1,
        success: overallSuccess,
        duration: new Date().getTime() - startTime.getTime(),
        timestamp: new Date(),
      };

      try {
        await triggerHook('afterToolExecution', batchAfterData);
      } catch (hookError) {
        console.debug(`Hook error (afterToolExecution batch): ${hookError}`);
      }

      return { success: overallSuccess, results };
    } catch (error) {
      // 🪝 HOOK: onError - KI-freundliche Regelwelt (Batch Error)
      const errorData: ErrorHookData = {
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'batch-action-execution',
        filePath: projectPath,
        timestamp: new Date(),
      };

      try {
        await triggerHook('onError', errorData);
      } catch (hookError) {
        console.debug(`Hook error (onError batch): ${hookError}`);
      }

      throw error;
    }
  }

  async rollbackTool(projectPath: string, toolName: string): Promise<boolean> {
    const startTime = new Date();
    const action = this.actions.get(toolName);

    if (!action) {
      console.log(chalk.red(`❌ No action available for tool: ${toolName}`));
      return false;
    }

    // 🪝 HOOK: beforeToolExecution - KI-freundliche Regelwelt (Rollback)
    const beforeData: BeforeToolExecutionData = {
      toolName: `${toolName}-rollback`,
      filePath: projectPath,
      command: 'rollback-action',
      timestamp: startTime,
    };

    try {
      await triggerHook('beforeToolExecution', beforeData);
    } catch (hookError) {
      console.debug(
        `Hook error (beforeToolExecution rollback ${toolName}): ${hookError}`
      );
    }

    try {
      console.log(chalk.yellow(`🔄 Rolling back ${toolName}...`));
      const success = await action.rollback(projectPath);

      if (success) {
        console.log(chalk.green(`✅ ${toolName} rollback completed`));
      } else {
        console.log(chalk.red(`❌ ${toolName} rollback failed`));
      }

      // 🪝 HOOK: afterToolExecution - KI-freundliche Regelwelt (Rollback)
      const afterData: AfterToolExecutionData = {
        toolName: `${toolName}-rollback`,
        filePath: projectPath,
        command: 'rollback-action',
        output: success ? 'Rollback completed successfully' : 'Rollback failed',
        exitCode: success ? 0 : 1,
        success: success,
        duration: new Date().getTime() - startTime.getTime(),
        timestamp: new Date(),
      };

      try {
        await triggerHook('afterToolExecution', afterData);
      } catch (hookError) {
        console.debug(
          `Hook error (afterToolExecution rollback ${toolName}): ${hookError}`
        );
      }

      return success;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.log(chalk.red(`❌ ${toolName} rollback failed: ${errorMessage}`));

      // 🪝 HOOK: onError - KI-freundliche Regelwelt (Rollback Error)
      const errorData: ErrorHookData = {
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'rollback-action',
        filePath: projectPath,
        toolName: toolName,
        timestamp: new Date(),
      };

      try {
        await triggerHook('onError', errorData);
      } catch (hookError) {
        console.debug(
          `Hook error (onError rollback ${toolName}): ${hookError}`
        );
      }

      // 🪝 HOOK: afterToolExecution - KI-freundliche Regelwelt (Rollback Failed)
      const afterErrorData: AfterToolExecutionData = {
        toolName: `${toolName}-rollback`,
        filePath: projectPath,
        command: 'rollback-action',
        output: `Rollback failed: ${errorMessage}`,
        exitCode: 1,
        success: false,
        duration: new Date().getTime() - startTime.getTime(),
        timestamp: new Date(),
      };

      try {
        await triggerHook('afterToolExecution', afterErrorData);
      } catch (hookError) {
        console.debug(
          `Hook error (afterToolExecution rollback error ${toolName}): ${hookError}`
        );
      }

      return false;
    }
  }

  getAvailableActions(): string[] {
    return Array.from(this.actions.keys());
  }
}
