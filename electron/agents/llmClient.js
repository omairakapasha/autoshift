'use strict';

const { BaseChatModel } = require('@langchain/core/language_models/chat_model');
const { AIMessageChunk } = require('@langchain/core/messages');
const { CallbackManagerForLLMRun } = require('@langchain/core/callbacks/manager');
const litellm = require('litellm');

/**
 * LiteLLM-based Chat Model for LangChain
 * Works with Gemini, Claude, GPT-4, Ollama, Mistral, and more
 * Just change config to use different models
 */

class LiteLLMChatModel extends BaseChatModel {
  constructor(config) {
    super(config);
    this.config = config.llm;
    this.provider = this.config.provider;
    this.model = this.config.model;
    this.apiKey = this.config.apiKey;
    this.temperature = this.config.temperature || 0.7;
    this.maxTokens = this.config.maxTokens || 1024;

    // Set API key for the provider
    this.setupApiKey();
  }

  setupApiKey() {
    // LiteLLM automatically picks up env vars, but we can set them explicitly
    if (this.apiKey) {
      if (this.provider === 'gemini') {
        process.env.GOOGLE_API_KEY = this.apiKey;
      } else if (this.provider === 'openai') {
        process.env.OPENAI_API_KEY = this.apiKey;
      } else if (this.provider === 'anthropic') {
        process.env.ANTHROPIC_API_KEY = this.apiKey;
      } else if (this.provider === 'mistral') {
        process.env.MISTRAL_API_KEY = this.apiKey;
      }
    }
  }

  get lc_namespace() {
    return ['langchain', 'chat_models', 'litellm'];
  }

  async _generate(messages, options, runManager) {
    try {
      // Convert LangChain messages to LiteLLM format
      const llmMessages = messages.map((msg) => ({
        role: msg._getType() === 'human' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Call LiteLLM
      const response = await litellm.completion({
        model: `${this.provider}/${this.model}`,
        messages: llmMessages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        timeout: this.config.timeout || 30000,
      });

      const content = response.choices[0].message.content;

      // Convert back to LangChain format
      return {
        generations: [
          {
            message: new AIMessageChunk({ content }),
            text: content,
          },
        ],
      };
    } catch (error) {
      console.error(
        `LiteLLM Error (${this.provider}/${this.model}):`,
        error.message
      );
      throw new Error(
        `Failed to get LLM response: ${error.message}`
      );
    }
  }

  _llmType() {
    return `litellm-${this.provider}-${this.model}`;
  }
}

module.exports = { LiteLLMChatModel };
