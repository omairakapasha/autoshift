'use strict';

/**
 * LiteLLM Configuration for model-agnostic LLM support
 * Easily switch between Gemini, Claude, Llama, etc. by changing the model parameter
 */

const config = {
  // Twilio SMS
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER, // e.g., "+1234567890"
  },

  // LLM via LiteLLM (model-agnostic)
  llm: {
    // Current: Google Gemini
    provider: 'gemini', // Options: 'gemini', 'claude', 'gpt-4', 'ollama', 'mistral', etc.
    model: 'gemini-1.5-flash', // Google Gemini Pro - fast & free tier available
    apiKey: process.env.GOOGLE_API_KEY, // Get from https://makersuite.google.com/app/apikeys
    temperature: 0.7,
    maxTokens: 1024,
    timeout: 30000,
  },

  // Agent settings
  agent: {
    maxRetries: 3,
    conversationTimeout: 3600000, // 1 hour in ms
    reminderThresholdDays: 14, // Remind when service is 14 days away
  },
};

/**
 * Model Examples (just change config.llm.provider and config.llm.model):
 *
 * Google Gemini (FREE tier available):
 *   provider: 'gemini'
 *   model: 'gemini-1.5-flash' or 'gemini-1.5-pro'
 *   apiKey: GOOGLE_API_KEY
 *
 * OpenAI GPT-4:
 *   provider: 'openai'
 *   model: 'gpt-4-turbo' or 'gpt-4o'
 *   apiKey: OPENAI_API_KEY
 *
 * Anthropic Claude:
 *   provider: 'anthropic'
 *   model: 'claude-3-5-sonnet-20241022'
 *   apiKey: ANTHROPIC_API_KEY
 *
 * Open Source (Ollama locally):
 *   provider: 'ollama'
 *   model: 'llama2' or 'mistral'
 *   apiKey: (not needed for local)
 *
 * Mistral AI:
 *   provider: 'mistral'
 *   model: 'mistral-large' or 'mistral-medium'
 *   apiKey: MISTRAL_API_KEY
 */

module.exports = config;
