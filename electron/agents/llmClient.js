'use strict';

const { BaseChatModel } = require('@langchain/core/language_models/chat_model');
const { AIMessageChunk } = require('@langchain/core/messages');

/**
 * Universal LLM Client using native API calls
 * Works with Gemini, Claude, GPT-4, Ollama, etc.
 * No external LiteLLM package needed - uses fetch API
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
  }

  get lc_namespace() {
    return ['langchain', 'chat_models', 'universal'];
  }

  async _generate(messages, options, runManager) {
    try {
      const content = await this.callLLM(messages);
      
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
        `LLM Error (${this.provider}/${this.model}):`,
        error.message
      );
      throw new Error(`Failed to get LLM response: ${error.message}`);
    }
  }

  async callLLM(messages) {
    const llmMessages = messages.map((msg) => ({
      role: msg._getType() === 'human' ? 'user' : 'assistant',
      content: msg.content,
    }));

    if (this.provider === 'gemini') {
      return this.callGemini(llmMessages);
    } else if (this.provider === 'openai') {
      return this.callOpenAI(llmMessages);
    } else if (this.provider === 'anthropic') {
      return this.callClaude(llmMessages);
    } else if (this.provider === 'ollama') {
      return this.callOllama(llmMessages);
    } else {
      throw new Error(`Unsupported provider: ${this.provider}`);
    }
  }

  async callGemini(messages) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: this.temperature,
            maxOutputTokens: this.maxTokens,
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API error');
    }
    return data.candidates[0].content.parts[0].text;
  }

  async callOpenAI(messages) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API error');
    }
    return data.choices[0].message.content;
  }

  async callClaude(messages) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages,
        temperature: this.temperature,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Claude API error');
    }
    return data.content[0].text;
  }

  async callOllama(messages) {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        temperature: this.temperature,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Ollama API error');
    }
    return data.message.content;
  }

  _llmType() {
    return `universal-${this.provider}-${this.model}`;
  }
}

module.exports = { LiteLLMChatModel };
