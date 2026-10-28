'use strict';

/**
 * Twilio & LLM Configuration for Service Reminder Agent
 */

const config = {
  // Twilio SMS
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER, // e.g., "+1234567890"
  },

  // LLM (Claude via Anthropic)
  llm: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.7,
  },

  // Agent settings
  agent: {
    maxRetries: 3,
    conversationTimeout: 3600000, // 1 hour in ms
    reminderThresholdDays: 14, // Remind when service is 14 days away
  },
};

module.exports = config;
