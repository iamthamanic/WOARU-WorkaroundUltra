import chalk from 'chalk';
import { t } from '../config/i18n';
import { ConfigManager } from '../config/ConfigManager';
import { checkAiAvailability, getActiveProviders } from './ai-helpers';
import { UsageTracker } from '../ai/UsageTracker';
import { AIProviderUtils } from './AIProviderUtils';

/**
 * AI Control Center - Interactive menu system for managing AI providers
 * Implements the complete interface expected by the translation keys
 */

export interface AiProviderConfig {
  enabled: boolean;
  model?: string;
  id?: string;
  providerType?: string;
  [key: string]: unknown;
}

export interface AiConfig {
  multiAi?: boolean;
  primaryProvider?: string;
  lastDataUpdate?: string;
  [providerId: string]: AiProviderConfig | boolean | string | undefined;
}

/**
 * Main entry point for AI Control Center
 */
export async function showAiControlCenter(): Promise<void> {
  console.log(chalk.cyan.bold(t('cli.ai_control_center.title')));
  console.log();

  // Check if any providers are configured
  const isAvailable = await checkAiAvailability();
  if (!isAvailable) {
    console.log(chalk.yellow(t('ai_control_center.configure_providers_first')));
    console.log(chalk.blue('Run: woaru ai setup'));
    return;
  }

  // Show current status
  await displayCurrentStatus();
  console.log();

  // Show interactive menu
  await showInteractiveMenu();
}

/**
 * Display current AI configuration status
 */
async function displayCurrentStatus(): Promise<void> {
  console.log(chalk.blue(t('cli.ai_control_center.current_status')));

  // Use the new visual status system
  const { displayAiStatus } = await import('./ai-helpers');
  await displayAiStatus(false); // Show detailed status

  const configManager = ConfigManager.getInstance();
  const aiConfig = (await configManager.loadAiConfig()) as AiConfig;
  const activeProviders = await getActiveProviders();
  const usageTracker = UsageTracker.getInstance();

  // Show Multi-AI status
  const multiAiEnabled = aiConfig.multiAi === true;
  if (multiAiEnabled) {
    console.log(
      `  • ${chalk.green(t('cli.ai_control_center.multi_ai_enabled'))}`
    );
  } else {
    console.log(`  • ${chalk.gray(t('ai_control_center.multi_ai_disabled'))}`);
  }

  // Show primary provider
  if (aiConfig.primaryProvider) {
    console.log(
      `  • ${chalk.cyan(t('ai_control_center.primary_provider', { provider: aiConfig.primaryProvider }))}`
    );
  } else {
    console.log(
      `  • ${chalk.yellow(t('cli.ai_control_center.no_primary_provider'))}`
    );
  }

  // Show active providers
  console.log(`  • Active Providers: ${chalk.green(activeProviders.length)}`);
  for (const provider of activeProviders) {
    const hasApiKey = await configManager.hasApiKey(provider.id);
    const apiKeyStatus = hasApiKey
      ? chalk.green(t('ai_control_center.api_key_found'))
      : chalk.red(t('ai_control_center.api_key_missing'));
    console.log(`    - ${provider.id}: ${apiKeyStatus}`);
  }

  // Show usage statistics
  const totalUsage = await usageTracker.getTotalUsage();
  if (totalUsage.totalRequests > 0) {
    console.log(`  • Total Requests: ${chalk.cyan(totalUsage.totalRequests)}`);
    console.log(
      `  • Total Cost: ${chalk.green('$' + totalUsage.totalCost.toFixed(4))}`
    );
  }
}

/**
 * Show interactive menu for AI Control Center
 */
async function showInteractiveMenu(): Promise<void> {
  try {
    const { default: inquirer } = await import('inquirer');
    const configManager = ConfigManager.getInstance();
    const aiConfig = (await configManager.loadAiConfig()) as AiConfig;

    while (true) {
      const choices = [
        t('cli.ai_control_center.menu_options.add_edit_provider'),
      ];

      // Add Multi-AI toggle option
      if (aiConfig.multiAi === true) {
        choices.push(t('cli.ai_control_center.menu_options.disable_multi_ai'));
      } else {
        choices.push(t('cli.ai_control_center.menu_options.enable_multi_ai'));
      }

      choices.push(
        t('cli.ai_control_center.menu_options.select_primary'),
        t('cli.ai_control_center.menu_options.exit')
      );

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: t('cli.ai_control_center.menu_prompt'),
          choices,
        },
      ]);

      if (action === t('cli.ai_control_center.menu_options.exit')) {
        console.log(chalk.cyan(t('ai_control_center.goodbye')));
        break;
      } else if (
        action === t('cli.ai_control_center.menu_options.add_edit_provider')
      ) {
        await handleProviderManagement();
      } else if (
        action === t('cli.ai_control_center.menu_options.enable_multi_ai')
      ) {
        await enableMultiAi();
      } else if (
        action === t('cli.ai_control_center.menu_options.disable_multi_ai')
      ) {
        await disableMultiAi();
      } else if (
        action === t('cli.ai_control_center.menu_options.select_primary')
      ) {
        await selectPrimaryProvider();
      }

      // Refresh config after each operation
      const updatedConfig = (await configManager.loadAiConfig()) as AiConfig;
      Object.assign(aiConfig, updatedConfig);

      console.log(); // Add spacing between menu iterations
    }
  } catch (error) {
    console.error(chalk.red('Interactive menu failed:'), error);
  }
}

/**
 * Handle provider management (add/edit/remove providers)
 */
async function handleProviderManagement(): Promise<void> {
  try {
    const { default: inquirer } = await import('inquirer');
    const activeProviders = await getActiveProviders();

    // Show existing providers or add new one
    const choices = [
      ...activeProviders.map(p => `${p.id} (configured)`),
      'Add new provider',
      t('cli.provider_management.back_to_menu'),
    ];

    const { selection } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selection',
        message: t('cli.provider_management.select_provider'),
        choices,
      },
    ]);

    if (selection === t('cli.provider_management.back_to_menu')) {
      return;
    } else if (selection === 'Add new provider') {
      await addNewProvider();
    } else {
      // Edit existing provider
      const providerId = selection.split(' ')[0];
      await editProvider(providerId);
    }
  } catch (error) {
    console.error(chalk.red('Provider management failed:'), error);
  }
}

/**
 * Add a new AI provider
 */
async function addNewProvider(): Promise<void> {
  try {
    const { default: inquirer } = await import('inquirer');

    const supportedProviders = [
      'openai',
      'anthropic',
      'google',
      'azure',
      'deepseek',
      'ollama',
    ];

    const { providerId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'providerId',
        message: 'Select provider type:',
        choices: supportedProviders,
      },
    ]);

    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: t('cli.setup.api_key_prompt', { provider: providerId }),
        validate: (input: string) => input.length > 0 || 'API key is required',
      },
    ]);

    // Save API key
    const configManager = ConfigManager.getInstance();
    await configManager.saveApiKey(providerId, apiKey);

    // Fetch and select model
    console.log(t('cli.setup.loading_models'));
    const availableModels = await AIProviderUtils.fetchModelsForProvider(
      providerId,
      apiKey
    );

    if (availableModels.length === 0) {
      console.log(
        chalk.yellow('No models found. Using default configuration.')
      );
      return;
    }

    const { selectedModel } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedModel',
        message: t('cli.setup.select_model', { provider: providerId }),
        choices: availableModels.map(m => ({
          name: `${m.name} - ${m.description}`,
          value: m.id,
        })),
      },
    ]);

    const { enabled } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enabled',
        message: t('cli.setup.enable_for_analysis', { provider: providerId }),
        default: true,
      },
    ]);

    // Save provider configuration
    const aiConfig = (await configManager.loadAiConfig()) as AiConfig;
    aiConfig[providerId] = {
      enabled,
      model: selectedModel,
      id: providerId,
      providerType: providerId,
    };

    await configManager.saveAiConfig(aiConfig);

    console.log(
      chalk.green(
        t('cli.setup.provider_setup_complete', { provider: providerId })
      )
    );
  } catch (error) {
    console.error(chalk.red('Failed to add provider:'), error);
  }
}

/**
 * Edit an existing provider
 */
async function editProvider(providerId: string): Promise<void> {
  try {
    const { default: inquirer } = await import('inquirer');

    // Get current status for better UX
    const configManager = ConfigManager.getInstance();
    const aiConfig = (await configManager.loadAiConfig()) as AiConfig;
    const providerConfig = aiConfig[providerId] as AiProviderConfig;
    const currentStatus = providerConfig?.enabled ? 'enabled' : 'disabled';
    
    const actions = [
      t('cli.provider_management.change_model'),
      t('cli.provider_management.change_api_key'),
      `🔛 Toggle Code Reviews (Currently: ${currentStatus})`,
      t('cli.provider_management.remove_provider'),
      t('cli.provider_management.back_to_menu'),
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('cli.provider_management.provider_actions', {
          provider: providerId,
        }),
        choices: actions,
      },
    ]);

    // configManager and aiConfig already loaded above

    if (action === t('cli.provider_management.change_model')) {
      const { default: inquirer } = await import('inquirer');
      const apiKey = await configManager.getApiKey(providerId);
      if (apiKey) {
        // First show recommended models with option to see all
        const allModels = await AIProviderUtils.fetchModelsForProvider(
          providerId,
          apiKey
        );

        if (allModels.length > 0) {
          const recommendedModels = allModels.filter(m => m.isRecommended);
          const showRecommendedFirst = recommendedModels.length > 0;

          let selectedModel: string;

          if (showRecommendedFirst) {
            // Show recommended models first with option to see all
            const { modelChoice } = await inquirer.prompt([
              {
                type: 'list',
                name: 'modelChoice',
                message: `🎯 Select ${providerId} model (showing ${recommendedModels.length} recommended):`,
                choices: [
                  ...recommendedModels.map(m => ({
                    name: `${m.tier === 'flagship' ? '⭐' : m.tier === 'fast' ? '⚡' : '📊'} ${m.name} - ${m.description}`,
                    value: m.id,
                  })),
                  new inquirer.Separator(),
                  {
                    name: `📋 Show all ${allModels.length} models (including legacy/deprecated)`,
                    value: '__SHOW_ALL__',
                  },
                ],
              },
            ]);

            if (modelChoice === '__SHOW_ALL__') {
              // Show all models with clear categorization
              const { newModel } = await inquirer.prompt([
                {
                  type: 'list',
                  name: 'newModel',
                  message: `📋 All ${providerId} models (${allModels.length} total):`,
                  choices: allModels
                    .sort((a, b) => {
                      // Sort: recommended first, then by tier, then deprecated last
                      if (a.isRecommended !== b.isRecommended) {
                        return b.isRecommended ? 1 : -1;
                      }
                      if (a.isDeprecated !== b.isDeprecated) {
                        return a.isDeprecated ? 1 : -1;
                      }
                      return a.name.localeCompare(b.name);
                    })
                    .map(m => ({
                      name: `${
                        m.isRecommended ? '✅' : m.isDeprecated ? '⚠️ ' : '🔸'
                      } ${m.name} - ${m.description}${
                        m.isDeprecated ? ' (DEPRECATED)' : ''
                      }`,
                      value: m.id,
                    })),
                },
              ]);
              selectedModel = newModel;
            } else {
              selectedModel = modelChoice;
            }
          } else {
            // Fallback: show all models if no recommended models
            const { newModel } = await inquirer.prompt([
              {
                type: 'list',
                name: 'newModel',
                message: 'Select new model:',
                choices: allModels.map(m => ({
                  name: `${m.name} - ${m.description}`,
                  value: m.id,
                })),
              },
            ]);
            selectedModel = newModel;
          }

          providerConfig.model = selectedModel;
          await configManager.saveAiConfig(aiConfig);
          console.log(
            chalk.green(
              t('cli.provider_management.model_changed', {
                model: selectedModel,
              })
            )
          );
        }
      }
    } else if (action === t('cli.provider_management.change_api_key')) {
      const { newApiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'newApiKey',
          message: t('cli.provider_management.api_key_prompt', {
            provider: providerId,
          }),
          validate: (input: string) =>
            input.length > 0 || 'API key is required',
        },
      ]);

      await configManager.saveApiKey(providerId, newApiKey);
      console.log(chalk.green(t('cli.provider_management.api_key_validation')));
    } else if (action.startsWith('🔛 Toggle Code Reviews')) {
      providerConfig.enabled = !providerConfig.enabled;
      await configManager.saveAiConfig(aiConfig);
      const status = providerConfig.enabled ? 'enabled' : 'disabled';
      console.log(chalk.green(`✅ Code reviews for ${providerId} are now ${status}`));
      console.log(chalk.gray(`   This provider ${providerConfig.enabled ? 'will be used' : 'will NOT be used'} for AI code analysis.`));
    } else if (action === t('cli.provider_management.remove_provider')) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: t('cli.provider_management.confirm_removal', {
            provider: providerId,
          }),
          default: false,
        },
      ]);

      if (confirmed) {
        delete aiConfig[providerId];
        await configManager.saveAiConfig(aiConfig);
        await configManager.removeApiKey(providerId);
        console.log(
          chalk.green(
            t('cli.provider_management.provider_removed', {
              provider: providerId,
            })
          )
        );
      } else {
        console.log(chalk.gray(t('cli.provider_management.removal_cancelled')));
      }
    }
  } catch (error) {
    console.error(chalk.red('Failed to edit provider:'), error);
  }
}

/**
 * Enable Multi-AI Review mode
 */
async function enableMultiAi(): Promise<void> {
  try {
    const configManager = ConfigManager.getInstance();
    const aiConfig = (await configManager.loadAiConfig()) as AiConfig;

    aiConfig.multiAi = true;
    await configManager.saveAiConfig(aiConfig);

    console.log(chalk.green(t('ai_control_center.multi_ai_enabled_message')));
    console.log(chalk.gray(t('cli.ai_control_center.multi_ai_enabled')));
    console.log(chalk.gray(t('general.continue_prompt')));

    // Wait for user input
    const { default: inquirer } = await import('inquirer');
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '',
      },
    ]);
  } catch (error) {
    console.error(chalk.red('Failed to enable Multi-AI:'), error);
  }
}

/**
 * Disable Multi-AI Review mode
 */
async function disableMultiAi(): Promise<void> {
  try {
    const configManager = ConfigManager.getInstance();
    const aiConfig = (await configManager.loadAiConfig()) as AiConfig;

    aiConfig.multiAi = false;
    await configManager.saveAiConfig(aiConfig);

    console.log(chalk.yellow(t('ai_control_center.multi_ai_disabled_message')));
    console.log(
      chalk.gray(t('cli.ai_control_center.disable_multi_ai_explanation'))
    );
    console.log(chalk.gray(t('general.continue_prompt')));

    // Wait for user input
    const { default: inquirer } = await import('inquirer');
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '',
      },
    ]);
  } catch (error) {
    console.error(chalk.red('Failed to disable Multi-AI:'), error);
  }
}

/**
 * Select primary provider for reviews
 */
async function selectPrimaryProvider(): Promise<void> {
  try {
    const { default: inquirer } = await import('inquirer');
    const activeProviders = await getActiveProviders();

    if (activeProviders.length === 0) {
      console.log(chalk.yellow(t('ai_control_center.no_providers_enabled')));
      return;
    }

    const { primaryProvider } = await inquirer.prompt([
      {
        type: 'list',
        name: 'primaryProvider',
        message: t('cli.provider_management.select_primary'),
        choices: activeProviders.map(p => p.id),
      },
    ]);

    const configManager = ConfigManager.getInstance();
    const aiConfig = (await configManager.loadAiConfig()) as AiConfig;
    aiConfig.primaryProvider = primaryProvider;
    await configManager.saveAiConfig(aiConfig);

    console.log(
      chalk.green(
        t('cli.provider_management.primary_selected', {
          provider: primaryProvider,
        })
      )
    );
  } catch (error) {
    console.error(chalk.red('Failed to select primary provider:'), error);
  }
}

/**
 * Show AI Setup interface (standalone command)
 */
export async function showAiSetup(): Promise<void> {
  console.log(chalk.cyan.bold(t('setup.ai_setup_title')));
  console.log();

  try {
    await addNewProvider();

    // Ask if user wants to set up another provider
    const { default: inquirer } = await import('inquirer');
    const { setupAnother } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setupAnother',
        message: t('cli.setup.setup_another'),
        default: false,
      },
    ]);

    if (setupAnother) {
      await showAiSetup(); // Recursive call for multiple setups
    } else {
      // Ask about Multi-AI mode
      const { enableMultiAi } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'enableMultiAi',
          message: t('cli.setup.enable_multi_ai'),
          default: false,
        },
      ]);

      if (enableMultiAi) {
        const configManager = ConfigManager.getInstance();
        const aiConfig = (await configManager.loadAiConfig()) as AiConfig;
        aiConfig.multiAi = true;
        await configManager.saveAiConfig(aiConfig);
        console.log(chalk.green(t('cli.setup.multi_ai_activated')));
      } else {
        console.log(chalk.gray(t('cli.setup.multi_ai_not_activated')));
      }

      console.log(chalk.green(t('setup.success')));
    }
  } catch (error) {
    console.error(chalk.red('AI setup failed:'), error);
  }
}
