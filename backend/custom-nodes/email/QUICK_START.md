# Email Nodes - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
cd backend/custom-nodes/email
npm install
```

### Step 2: Configure Credentials

#### For Gmail (Most Common)

**SMTP Credentials (Send):**
- Host: `smtp.gmail.com`
- Port: `587`
- Secure: `false` (uses STARTTLS)
- Username: `your-email@gmail.com`
- Password: Generate app-specific password at https://myaccount.google.com/apppasswords

**IMAP Credentials (Receive):**
- Host: `imap.gmail.com`
- Port: `993`
- Secure: `true` (SSL)
- Username: `your-email@gmail.com`
- Password: Same app-specific password

#### For Outlook/Office 365

**SMTP:**
- Host: `smtp-mail.outlook.com` or `smtp.office365.com`
- Port: `587`
- Secure: `false`

**IMAP:**
- Host: `outlook.office365.com`
- Port: `993`
- Secure: `true`

### Step 3: Test Email Send

Create a workflow:
1. Add **Manual Trigger** node
2. Add **Email Send** node
3. Configure:
   - Select SMTP credentials
   - To: `recipient@example.com`
   - Subject: `Test Email`
   - Message: `Hello from automation!`
4. Execute workflow

### Step 4: Test Email Receive

Create a workflow:
1. Add **Manual Trigger** node
2. Add **Email Receive** node
3. Configure:
   - Select IMAP credentials
   - Mailbox: `INBOX`
   - Filter: `Unseen`
   - Limit: `5`
4. Execute workflow

## 📋 Common Use Cases

### 1. Send Welcome Email
```
Webhook Trigger → Email Send
```
When user signs up, send welcome email.

### 2. Email Notification on Error
```
Schedule → HTTP Request → If (error) → Email Send
```
Monitor API and send alert on failure.

### 3. Process Incoming Emails
```
Schedule → Email Receive → Loop → Text Parser → Database
```
Fetch unread emails every 5 minutes and process them.

### 4. Auto-Reply Bot
```
Schedule → Email Receive (Unseen) → If (subject contains) → Email Send
```
Auto-respond to specific emails.

### 5. Email to Slack
```
Schedule → Email Receive → Slack Send
```
Forward important emails to Slack channel.

## 🔧 Troubleshooting

### Gmail "Less secure app" error
- Enable 2FA on your Google account
- Generate app-specific password
- Use that password instead of your main password

### Connection timeout
- Check firewall settings
- Verify host and port are correct
- Ensure SSL/TLS settings match server requirements

### Authentication failed
- Double-check username and password
- For Gmail, must use app-specific password
- Verify IMAP/SMTP is enabled in email settings

### No emails returned
- Check mailbox name (case-sensitive)
- Verify filter criteria
- Try "All" filter first to test connection

## 💡 Pro Tips

1. **Use Environment Variables**: Store credentials securely
2. **Test with Manual Trigger**: Before scheduling, test manually
3. **Start with Small Limits**: Use limit=1 when testing receive
4. **Check Spam Folder**: Sent emails might land in spam initially
5. **Use HTML for Rich Emails**: Better formatting and styling
6. **Base64 Attachments**: For small files, embed as base64 in JSON

## 📚 Next Steps

- Read full [README.md](./README.md) for advanced features
- Check IMAP search criteria for complex filters
- Explore attachment handling
- Build multi-step email workflows
