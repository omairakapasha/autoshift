# 🚗 Welcome to AutoShift: Showroom Manager

Thank you for choosing AutoShift. This guide will help you get your showroom up and running with your new AI-powered, offline-first management system.

---

## 🛠️ 1. First-Time Setup

Before you start, ensure your developer has initialized your database.

1.  **Install the App**: Run `AutoShift_Setup.exe` and follow the on-screen instructions.
2.  **Configure Credentials**: 
    *   Open the installation folder (Right-click the AutoShift desktop icon > **Open File Location**).
    *   Run the file named `configure_showroom.bat`.
    *   Enter your Supabase, Twilio, and Gemini keys as provided in your setup package.
    *   Set your **Staff PIN** (for daily use) and **Admin PIN** (for owner-only actions).

---

## 🔐 2. Daily Operations

### **Accessing the System**
When you open AutoShift, you will see a secure numpad. Enter your **Staff PIN** to unlock the dashboard.

### **Managing Vehicles & Services**
*   **Search**: Use the "Vehicle Lookup" to find existing cars by plate number.
*   **Register**: If a car is new, click "Register" to add the vehicle and the client details.
*   **Service**: Click "Add Service" on any vehicle page to log oil changes, inspections, or repairs.

---

## 💎 3. Premium Features

### **🌐 Offline Mode (High Reliability)**
**Don't let the internet slow you down!** If your internet goes out, AutoShift keeps working.
*   The **Cloud Icon** in the sidebar will turn **Red (Offline)**.
*   You can still add cars and services normally.
*   The system will **automatically sync** all your changes to the cloud the moment your internet returns.

### **🛡️ Admin Mode (Security)**
To protect your data, destructive actions like "Delete Vehicle" or "Edit Details" are locked.
*   Click **"SWITCH TO ADMIN"** at the bottom of the sidebar.
*   Enter your secret **Admin PIN**.
*   This mode should only be used by the owner or trusted managers.

### **🤖 AI Smart Outreach**
AutoShift uses Google Gemini AI to bring customers back to your showroom.
*   **Automated Reminders**: Every morning, the system checks which cars are due for service and sends personalized messages.
*   **Note**: Ensure you have active credits in your **Twilio** and **Gemini** accounts for these features to remain active.

---

## 📞 Support
If you encounter any issues or need to update your system, please contact your technical administrator.

**Version**: v1.0.0 (Stable)
