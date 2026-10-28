'use strict';

const { createTools } = require('./tools');
const { LiteLLMChatModel } = require('./llmClient');
const { StateGraph } = require('@langchain/langgraph');
const { HumanMessage } = require('@langchain/core/messages');

/**
 * Service Reminder & Booking Agent
 * Uses LangGraph with LiteLLM for model-agnostic LLM support
 * Works with Gemini, Claude, GPT-4, Ollama, etc.
 */

class ServiceAgent {
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.llm = new LiteLLMChatModel(config);
    this.tools = createTools(db);
    this.initializeGraph();
    console.log(`✅ Agent initialized with ${config.llm.provider}/${config.llm.model}`);
  }

  initializeGraph() {
    const graph = new StateGraph({
      channels: {
        messages: {
          value: (x, y) => x.concat(y),
          default: () => [],
        },
        clientPhone: {
          value: (x, y) => y ?? x,
          default: () => null,
        },
      },
    });

    // Define nodes
    graph.addNode('agent', (state) => this.agentNode(state));
    graph.addNode('tools', (state) => this.toolNode(state));

    // Define edges
    graph.addEdge('__start__', 'agent');
    graph.addConditionalEdges('agent', (state) => this.shouldUseTool(state), {
      tools: 'tools',
      end: '__end__',
    });
    graph.addEdge('tools', 'agent');

    this.graph = graph.compile();
  }

  async agentNode(state) {
    const messages = state.messages || [];
    const response = await this.llm.bindTools(this.tools).invoke(messages);
    return { messages: [response] };
  }

  async toolNode(state) {
    const messages = state.messages || [];
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage.tool_calls) return state;

    const results = [];
    for (const toolCall of lastMessage.tool_calls) {
      const tool = this.tools.find((t) => t.name === toolCall.name);
      if (!tool) continue;

      const result = await tool.func(toolCall.args);
      results.push({
        type: 'tool',
        content: JSON.stringify(result),
        tool_use_id: toolCall.id,
      });
    }

    return { messages: results };
  }

  shouldUseTool(state) {
    const messages = state.messages || [];
    const lastMessage = messages[messages.length - 1];
    return lastMessage.tool_calls ? 'tools' : 'end';
  }

  async chat(userMessage, clientPhone) {
    const state = {
      messages: [new HumanMessage(userMessage)],
      clientPhone,
    };

    const result = await this.graph.invoke(state);
    const lastMessage = result.messages[result.messages.length - 1];

    return lastMessage.content || 'Could not process request';
  }

  /**
   * Automated: Check for overdue services and send reminders
   */
  async sendServiceReminders() {
    const dueSoon = this.db
      .prepare(`
        SELECT DISTINCT
          cl.phone,
          cl.name,
          GROUP_CONCAT(c.plate || ' (' || c.make || ' ' || c.model || ')') as vehicles,
          COUNT(*) as count
        FROM clients cl
        JOIN cars c ON cl.id = c.client_id
        JOIN services s ON c.plate = s.plate
        WHERE s.next_due <= date('now', '+14 days')
          AND s.next_due > date('now', '-1 days')
        GROUP BY cl.id
      `)
      .all();

    const results = [];
    for (const client of dueSoon) {
      const message = `Hi ${client.name}, your ${client.vehicles} need service soon (${client.count} vehicle(s)). Reply to book an appointment.`;

      try {
        // Send SMS via Twilio (in production)
        console.log(`[REMINDER SMS] ${client.phone}: ${message}`);
        results.push({ phone: client.phone, sent: true });
      } catch (error) {
        console.error(`Failed to send reminder to ${client.phone}:`, error);
        results.push({ phone: client.phone, sent: false, error });
      }
    }

    return results;
  }
}

module.exports = { ServiceAgent };
