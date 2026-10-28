'use strict';

const Imap = require('imap');
const { simpleParser } = require('mailparser');

/**
 * Email Listener - Monitor incoming emails for appointment confirmations/cancellations
 * Supports Gmail IMAP
 */

class EmailListener {
  constructor(config) {
    this.config = config.email;
    this.agent = null;
    this.imap = null;
    this.isConnected = false;
  }

  /**
   * Initialize and connect to Gmail IMAP
   */
  async connect() {
    return new Promise((resolve, reject) => {
      if (this.config.provider !== 'gmail') {
        reject(new Error('Email listener only supports Gmail IMAP'));
        return;
      }

      this.imap = new Imap({
        user: this.config.gmail.user,
        password: this.config.gmail.password,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 10000,
        authTimeout: 5000,
      });

      this.imap.on('ready', () => {
        console.log('✅ Connected to Gmail IMAP');
        this.openInbox(resolve);
      });

      this.imap.on('error', (err) => {
        console.error('❌ Email listener error:', err.message);
        reject(err);
      });

      this.imap.on('alert', (alert) => {
        console.log('📧 Gmail alert:', alert);
      });

      this.imap.connect();
    });
  }

  /**
   * Open INBOX and start watching
   */
  openInbox(callback) {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('❌ Failed to open inbox:', err.message);
        callback();
        return;
      }

      console.log(`📬 Inbox opened (${box.messages.total} messages)`);
      this.isConnected = true;
      this.watchForNewEmails();
      callback();
    });
  }

  /**
   * Watch for new emails
   */
  watchForNewEmails() {
    this.imap.on('mail', () => {
      console.log('📧 New email received - fetching...');
      this.fetchNewEmails();
    });
  }

  /**
   * Fetch new emails
   */
  fetchNewEmails() {
    try {
      // Search for unseen emails
      this.imap.search(['UNSEEN'], (err, results) => {
        if (err) {
          console.error('Search error:', err.message);
          return;
        }

        if (results.length === 0) {
          return;
        }

        const f = this.imap.fetch(results, { bodies: '' });

        f.on('message', (msg, seqno) => {
          this.parseEmail(msg, seqno);
        });

        f.on('error', (err) => {
          console.error('Fetch error:', err.message);
        });
      });
    } catch (error) {
      console.error('Error fetching emails:', error.message);
    }
  }

  /**
   * Parse incoming email
   */
  parseEmail(msg, seqno) {
    simpleParser(msg, async (err, parsed) => {
      if (err) {
        console.error('Parse error:', err.message);
        return;
      }

      try {
        const from = parsed.from?.text || 'unknown';
        const subject = parsed.subject || '(no subject)';
        const text = parsed.text || '';

        console.log(`\n📬 From: ${from}`);
        console.log(`   Subject: ${subject}`);

        // Filter: Check if email is related to AutoShift
        if (!this.isAutoShiftRelated(subject, text, from)) {
          console.log('   ⏭️  Skipped - not related to AutoShift');
          msg.setFlags(['\\Seen'], (err) => {});
          return;
        }

        console.log(`   Preview: ${text.substring(0, 80)}...`);

        // Extract client email
        const clientEmail = parsed.from?.html?.match(/[\w.-]+@[\w.-]+/)?.[0] || from;

        // Process based on content
        if (this.isConfirmation(subject, text)) {
          await this.handleConfirmation(clientEmail, subject, text);
        } else if (this.isCancellation(subject, text)) {
          await this.handleCancellation(clientEmail, subject, text);
        } else if (this.isReschedule(subject, text)) {
          await this.handleReschedule(clientEmail, subject, text);
        } else if (this.isAutoShiftQuery(subject, text)) {
          // Only process general inquiries if they mention AutoShift/service/appointment
          await this.handleGeneralInquiry(clientEmail, text);
        } else {
          console.log('   ⏭️  Not an AutoShift-related inquiry');
        }

        // Mark as read
        msg.setFlags(['\\Seen'], (err) => {
          if (err) console.error('Error marking read:', err.message);
        });
      } catch (error) {
        console.error('Processing error:', error.message);
      }
    });
  }

  /**
   * Check if email is related to AutoShift at all
   * Prevents processing random emails (newsletters, spam, etc.)
   */
  isAutoShiftRelated(subject, text, from) {
    const autoShiftKeywords = [
      'autoshift', 'service', 'appointment', 'booking', 'vehicle', 'car',
      'oil change', 'maintenance', 'reminder', 'confirmation', 'technician',
      'mechanic', 'garage', 'showroom', 'plate', 'vin'
    ];

    const combined = (subject + ' ' + text + ' ' + from).toLowerCase();
    
    // Must contain at least one AutoShift-related keyword
    const hasKeyword = autoShiftKeywords.some(kw => combined.includes(kw));
    
    // Reject obvious spam/automated emails
    const isSpam = combined.includes('unsubscribe') && 
                   !combined.includes('appointment');
    
    return hasKeyword && !isSpam;
  }

  /**
   * Check if this is an AutoShift-related query (not just confirmation/cancel/reschedule)
   */
  isAutoShiftQuery(subject, text) {
    const queryKeywords = [
      'question', 'help', 'how', 'when', 'where', 'what',
      'need', 'want', 'interested', 'inquire', 'asking',
      'please', 'thanks'
    ];
    
    const combined = (subject + ' ' + text).toLowerCase();
    return queryKeywords.some(kw => combined.includes(kw));
  }

  isConfirmation(subject, text) {
    const keywords = ['confirm', 'yes', 'approve', 'book', 'appointment'];
    const combined = (subject + ' ' + text).toLowerCase();
    return keywords.some(kw => combined.includes(kw));
  }

  isCancellation(subject, text) {
    const keywords = ['cancel', 'reschedule', 'postpone', 'delay', 'later'];
    const combined = (subject + ' ' + text).toLowerCase();
    return keywords.some(kw => combined.includes(kw));
  }

  isReschedule(subject, text) {
    const keywords = ['reschedule', 'change date', 'different time', 'move to'];
    const combined = (subject + ' ' + text).toLowerCase();
    return keywords.some(kw => combined.includes(kw));
  }

  async handleConfirmation(clientEmail, subject, text) {
    console.log(`✅ Appointment confirmation from ${clientEmail}`);
    try {
      // Update appointment status to Confirmed
      const appointments = this.db.prepare('SELECT * FROM appointments WHERE client_id = (SELECT id FROM clients WHERE email = ?) ORDER BY created_at DESC LIMIT 1').all(clientEmail);
      if (appointments.length > 0) {
        const appt = appointments[0];
        this.db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('Confirmed', appt.id);
        console.log(`   Updated appointment ${appt.id} to Confirmed`);
      }
    } catch (error) {
      console.error('Error handling confirmation:', error.message);
    }
  }

  async handleCancellation(clientEmail, subject, text) {
    console.log(`❌ Appointment cancellation from ${clientEmail}`);
    try {
      // Cancel latest pending appointment
      const appointments = this.db.prepare('SELECT * FROM appointments WHERE client_id = (SELECT id FROM clients WHERE email = ?) AND status = ? ORDER BY created_at DESC LIMIT 1').all(clientEmail, 'Confirmed');
      if (appointments.length > 0) {
        const appt = appointments[0];
        this.db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('Cancelled', appt.id);
        console.log(`   Cancelled appointment ${appt.id}`);
      }
    } catch (error) {
      console.error('Error handling cancellation:', error.message);
    }
  }

  async handleReschedule(clientEmail, subject, text) {
    console.log(`🔄 Reschedule request from ${clientEmail}`);
    try {
      // Find client's next appointment and mark as needs rescheduling
      const appointments = this.db.prepare('SELECT * FROM appointments WHERE client_id = (SELECT id FROM clients WHERE email = ?) AND status = ? ORDER BY date ASC LIMIT 1').all(clientEmail, 'Confirmed');
      if (appointments.length > 0) {
        const appt = appointments[0];
        this.db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('Pending', appt.id);
        console.log(`   Marked appointment ${appt.id} as Pending (awaiting new date)`);
      }
    } catch (error) {
      console.error('Error handling reschedule:', error.message);
    }
  }

  async handleGeneralInquiry(clientEmail, text) {
    console.log(`💬 General inquiry from ${clientEmail}`);
    
    if (this.agent) {
      try {
        const response = await this.agent.chat(text, clientEmail);
        console.log(`   Agent: ${response.substring(0, 100)}...`);
      } catch (error) {
        console.error('Agent error:', error.message);
      }
    }
  }

  /**
   * Disconnect from Gmail
   */
  disconnect() {
    if (this.imap && this.isConnected) {
      try {
        this.imap.closeBox(false, () => {
          this.imap.closeConnection();
        });
        this.isConnected = false;
        console.log('📧 Email listener disconnected');
      } catch (error) {
        console.error('Disconnect error:', error.message);
      }
    }
  }

  /**
   * Set the agent reference
   */
  setAgent(agent) {
    this.agent = agent;
  }
}

module.exports = { EmailListener };
