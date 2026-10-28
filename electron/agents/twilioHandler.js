'use strict';

const twilio = require('twilio');

/**
 * Twilio SMS handler for incoming and outgoing messages
 */

class TwilioHandler {
  constructor(config) {
    this.config = config;
    this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
  }

  /**
   * Send SMS message
   */
  async sendSMS(toNumber, message) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.config.twilio.phoneNumber,
        to: toNumber,
      });
      return { success: true, messageSid: result.sid };
    } catch (error) {
      console.error('Failed to send SMS:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle incoming SMS webhook from Twilio
   * Route to agent for conversation
   */
  async handleIncomingSMS(req, agent) {
    const fromNumber = req.body.From;
    const messageBody = req.body.Body;

    try {
      const response = await agent.chat(messageBody, fromNumber);

      // Send response back to user
      await this.sendSMS(fromNumber, response);

      return { success: true, response };
    } catch (error) {
      console.error('Error handling incoming SMS:', error);
      const errorMsg =
        'Sorry, I encountered an error. Please try again or contact support.';
      await this.sendSMS(fromNumber, errorMsg);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send bulk reminders to all clients with due services
   */
  async sendBulkReminders(reminders) {
    const results = [];
    for (const reminder of reminders) {
      const result = await this.sendSMS(reminder.phone, reminder.message);
      results.push({
        phone: reminder.phone,
        ...result,
      });
    }
    return results;
  }
}

module.exports = { TwilioHandler };
