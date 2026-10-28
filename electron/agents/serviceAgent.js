'use strict';

const { createTools } = require('./tools');
const { LiteLLMChatModel } = require('./llmClient');

/**
 * Service Reminder & Booking Agent
 * Simple agent that uses LLM + tools for service management
 * Works with Gemini, Claude, GPT-4, Ollama, etc.
 */

class ServiceAgent {
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.llm = new LiteLLMChatModel(config);
    this.tools = createTools(db);
    this.conversationHistory = new Map(); // Store per-user conversation history
    console.log(`✅ Agent initialized with ${config.llm.provider}/${config.llm.model}`);
  }

  /**
   * Chat with the agent
   * @param {string} userMessage - User's input
   * @param {string} clientId - Unique client identifier (phone number, email, or ID)
   * @returns {Promise<string>} - Agent's response
   */
  async chat(userMessage, clientId) {
    try {
      // Get or create conversation history for this client
      if (!this.conversationHistory.has(clientId)) {
        this.conversationHistory.set(clientId, []);
      }
      const history = this.conversationHistory.get(clientId);

      // Add user message to history
      history.push({ role: 'user', content: userMessage });

      // Call LLM with context about available tools
      const toolDescriptions = this.tools.map(tool => 
        `- ${tool.name}: ${tool.description}`
      ).join('\n');

      const systemPrompt = `You are a helpful car service assistant. You can help users with:
${toolDescriptions}

Available tools:
1. get_due_services - Get services due for a client
2. get_appointment_slots - Get available appointment times
3. book_appointment - Book an appointment
4. send_email - Send email notifications
5. send_sms - Send SMS notifications
6. notify_staff - Alert staff about bookings

Based on the user's message, decide if you need to use any tools. If you do, respond with:
[TOOL_CALL: tool_name | param1=value1 | param2=value2]

Be concise and helpful.`;

      const llmMessages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-5), // Keep last 5 messages for context
      ];

      const response = await this.llm.chat(userMessage, llmMessages.slice(0, -1));

      // Check if response contains tool calls
      const toolCallMatch = response.match(/\[TOOL_CALL: (\w+) \| (.*?)\]/);
      let finalResponse = response;

      if (toolCallMatch) {
        const toolName = toolCallMatch[1];
        const paramsStr = toolCallMatch[2];
        
        // Parse parameters
        const params = {};
        paramsStr.split(' | ').forEach(param => {
          const [key, value] = param.split('=');
          params[key] = value;
        });

        // Execute tool
        const tool = this.tools.find(t => t.name === toolName);
        if (tool) {
          try {
            const toolResult = await tool.func(params);
            finalResponse = `Based on the information I found:\n${JSON.stringify(toolResult, null, 2)}\n\n${response.replace(/\[TOOL_CALL:.*?\]/, '')}`;
          } catch (error) {
            finalResponse = `I encountered an error while processing your request: ${error.message}`;
          }
        }
      }

      // Add assistant response to history
      history.push({ role: 'assistant', content: finalResponse });

      // Keep history manageable (max 20 messages)
      if (history.length > 20) {
        history.splice(0, 2);
      }

      return finalResponse;
    } catch (error) {
      console.error('Chat error:', error);
      return `Sorry, I encountered an error: ${error.message}. Please try again or contact support.`;
    }
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
          cl.email,
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
        console.log(`[REMINDER] ${client.phone}: ${message}`);
        results.push({ 
          phone: client.phone,
          email: client.email,
          name: client.name,
          sent: true 
        });
      } catch (error) {
        console.error(`Failed to send reminder to ${client.phone}:`, error);
        results.push({ 
          phone: client.phone,
          sent: false, 
          error: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Get pending appointments for admin review
   */
  getPendingAppointments() {
    return this.db
      .prepare(`
        SELECT 
          a.id,
          a.plate,
          a.date,
          a.time,
          a.type,
          c.name as client_name,
          c.phone as client_phone,
          c.email as client_email,
          ca.make,
          ca.model
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN cars ca ON a.plate = ca.plate
        WHERE a.status = 'Pending'
        ORDER BY a.date, a.time
      `)
      .all();
  }

  /**
   * Clear conversation history (optional cleanup)
   */
  clearHistory(clientId) {
    if (clientId) {
      this.conversationHistory.delete(clientId);
    } else {
      this.conversationHistory.clear();
    }
  }
}

module.exports = { ServiceAgent };
