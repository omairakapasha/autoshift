# Setup: Configure API Keys & Credentials

For showroom owner to configure their own credentials.

## 📋 What You Need

1. **Google Gemini API Key** (for AI scheduling)
2. **Gmail credentials** (for sending emails)
3. **Twilio credentials** (optional, for SMS)

---

## 🔧 Step-by-Step Setup

### **1. Get Google Gemini API Key**

**Free tier available - $0 cost**

1. Go to: https://makersuite.google.com/app/apikeys
2. Click "Create API Key"
3. Copy the key
4. Open `.env` file in project root
5. Find: `GOOGLE_API_KEY=`
6. Paste key: `GOOGLE_API_KEY=YOUR_KEY_HERE`
7. Save file

**Example:**
```
GOOGLE_API_KEY=YOUR_KEY_HERE
```

---

### **2. Get Gmail App Password**

**Use your existing Gmail account**

1. Enable 2-Factor Authentication:
   - Go to: https://myaccount.google.com/security
   - Click "2-Step Verification"
   - Follow setup steps (code via phone)

2. Create App Password:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Google gives you a 16-character password
   - Copy it

3. Edit `.env`:
   ```
   EMAIL_PROVIDER=gmail
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```

4. Save file

**Example:**
```
GMAIL_USER=owner@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

**Note:** This is NOT your Gmail password. It's a special app-only password.

---

### **3. (Optional) Get Twilio SMS**

**For SMS notifications**

1. Go to: https://www.twilio.com/console
2. Sign up (free trial with $15 credit)
3. Get credentials:
   - Account SID
   - Auth Token
   - Phone Number (assigned to account)

4. Edit `.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_PHONE_NUMBER=+1234567890
   ```

5. Save file

---

## 📝 .env File Location

**Windows:**
```
C:\Users\YourUsername\OneDrive\Desktop\autoshift\.env
```

**Or wherever you installed AutoShift**

---

## ✅ Verify Setup

**After configuring, verify credentials work:**

```bash
# Open terminal in AutoShift folder
cd c:\Users\YourUsername\OneDrive\Desktop\autoshift

# Start the server
node electron/agents/start.js
```

**Expected output:**
```
✓ Database connected
✓ Gemini LLM initialized
✓ Email handler ready (Gmail IMAP listener active)
✓ Scheduler started
✓ Webhook server running on http://localhost:3001
```

**Test email sending:**
```bash
curl -X POST http://localhost:3001/admin/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@gmail.com",
    "clientName": "Test",
    "messageType": "reminder",
    "appointmentDetails": {
      "vehicles": ["Test Vehicle"],
      "daysUntilDue": 7
    }
  }'
```

**Check your inbox** → Should receive test email

---

## 🔒 Security Notes

1. **Never share `.env` file** - Contains credentials
2. **Don't commit `.env` to GitHub** - Already in `.gitignore`
3. **App Password, not Gmail password** - Use app-specific password only
4. **Single machine use** - Database is local, no cloud sync

---

## ❌ Troubleshooting

### **"Email not sending"**
- Check Gmail user is correct
- Verify 2FA is enabled
- Verify app password is correct (16 chars with spaces)
- Check spam folder

### **"Gemini API error"**
- Verify API key is correct
- Check you didn't hit free tier quota
- Get new key from makersuite.google.com

### **"Can't find .env file"**
- Create it in project root folder
- Copy content from `.env.example`
- Edit with your credentials

---

## 📂 Alternative: Use Different Email Provider

### **SendGrid (Production recommended)**

1. Sign up: https://sendgrid.com
2. Create API key
3. Edit `.env`:
   ```
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=SG.your_key_here
   ```

### **Custom SMTP**

```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email
SMTP_PASSWORD=your-password
```

---

## 🚀 Done!

Now when you run the app:
1. Scheduler will send automated reminders
2. Admin can send bulk campaigns
3. Appointment confirmations go out automatically
4. All with YOUR credentials

**Everything stays on your machine. No data sent anywhere except email provider.**

---

## 💡 Quick Checklist

- [ ] Google Gemini API key added
- [ ] Gmail user email set
- [ ] Gmail app password set (16 chars)
- [ ] 2FA enabled on Gmail
- [ ] `.env` file saved
- [ ] Tested with `node electron/agents/start.js`
- [ ] Sent test email successfully
- [ ] Ready to deploy

Done! ✅
