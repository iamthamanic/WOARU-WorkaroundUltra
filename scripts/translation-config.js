/**
 * Translation validation configuration
 * Defines rules and exceptions for translation validation
 */

export default {
  // Validation rules
  rules: {
    // Allow empty translations for these keys (they may be intentionally empty)
    allowEmptyKeys: [
      'cli.ai_control_center.continue_prompt',
      'cli.setup.loading_models', 
      'cli.additional_recommendations',
      'version.checking_updates',
      'setup.loading_models',
      'messages.analyzing_project',
      'messages.analyzing_codebase',
      'messages.running_security_analysis',
      'messages.running_infrastructure_audit',
      'messages.running_production_audit',
      'messages.project_well_configured',
      'messages.updating_database',
      'messages.database_updated',
      'messages.database_update_failed',
      'messages.fetching_openai_models',
      'messages.fetching_google_models',
      'messages.invalid_api_key'
    ],

    // Keys that are allowed to be missing in some languages (language-specific)
    allowMissingKeys: {
      'en': [
        // Keys that are specific to German language
      ],
      'de': [
        // Keys that are specific to English language
      ]
    },

    // Minimum completion percentage required for each language
    minimumCompletion: {
      'en': 90, // English should be at least 90% complete (reference language)
      'de': 85  // German can be slightly less complete
    },

    // Maximum allowed missing keys per language
    maxMissingKeys: {
      'en': 30,
      'de': 100
    }
  },

  // Reference language (most complete)
  referenceLanguage: 'en',

  // Languages that must be validated
  requiredLanguages: ['en', 'de'],

  // Validation modes
  modes: {
    // Strict mode for CI/production builds
    strict: {
      allowEmptyKeys: [],
      allowMissingKeys: {},
      minimumCompletion: { 'en': 100, 'de': 95 },
      maxMissingKeys: { 'en': 0, 'de': 5 }
    },

    // Development mode - more lenient
    development: {
      allowEmptyKeys: [
        'cli.ai_control_center.continue_prompt',
        'cli.setup.loading_models',
        'version.checking_updates',
        'setup.loading_models'
      ],
      minimumCompletion: { 'en': 80, 'de': 70 },
      maxMissingKeys: { 'en': 20, 'de': 50 }
    }
  }
};