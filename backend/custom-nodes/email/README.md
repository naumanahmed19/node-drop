# Email Nodes

Two separate nodes for email automation: **Email Send** (SMTP) and **Email Receive** (IMAP).

## 📧 Email Send Node

Send emails via SMTP protocol.

### Features
- Send plain text or HTML emails
- Multiple recipients (To, CC, BCC)
- Custom sender name and email
- File attachments support
- Works with Gmail, Outlook, and any SMTP server

### Configuration

**SMTP Credentials:**
- Host: SMTP server (e.g., smtp.gmail.com)
- Port: 587 (TLS), 465 (SSL), or 25
- Username: Your email address
- Password: Email password or app-specific password
- From Name/Email: Default sender info (optional)

**Node Properties:**
- From Email/Name: Override credential defaults
- To: Recipient email(s) - comma-separated
- CC/BCC: Carbon copy recipients (optional)
- Subject: Email subject line
- Email Type: Text or HTML
- Message: Email body content
- Attachments: JSON array of attachment objects

### Example Usage

**Send Simple Email:**
```javascript
To: user@example.com
Subject: Welcome!
Message: Thanks for signing up!
```

**Send HTML Email with Attachments:**
```javascript
Email Type: HTML
Message: <h1>Hello!</h1><p>Check the attachment.</p>
Attachments: [
  {
    "filename": "report.pdf",
    "path": "/path/to/report.pdf"
  }
]
```

### Gmail Setup
1. Enable 2-factor authentication
2. Generate app-specific password
3. Use smtp.gmail.com:587 with TLS

---

## 📬 Email Receive Node

Receive and read emails via IMAP protocol.

### Features
- Fetch emails from any mailbox (INBOX, Sent, etc.)
- Filter by read/unread status
- Custom IMAP search criteria
- Parse email content and attachments
- Mark emails as read option

### Configuration

**IMAP Credentials:**
- Host: IMAP server (e.g., imap.gmail.com)
- Port: 993 (SSL) or 143
- Secure: Enable SSL/TLS
- Username: Your email address
- Password: Email password or app-specific password

**Node Properties:**
- Mailbox: Folder to read from (default: INBOX)
- Filter: All, Unseen, Seen, Flagged, or Custom
- Custom Criteria: IMAP search array (for custom filter)
- Limit: Max emails to fetch (0 = all)
- Mark as Read: Auto-mark fetched emails
- Read Only: Open mailbox without modifications

### Example Usage

**Fetch Unread Emails:**
```javascript
Mailbox: INBOX
Filter: Unseen
Limit: 10
```

**Custom Search:**
```javascript
Filter: Custom
Custom Criteria: ["UNSEEN", ["FROM", "boss@company.com"]]
```

**Output Format:**
```json
{
  "messageId": "<unique-id>",
  "from": "sender@example.com",
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "date": "2024-01-01T12:00:00.000Z",
  "text": "Plain text content",
  "html": "<p>HTML content</p>",
  "attachments": [
    {
      "filename": "file.pdf",
      "contentType": "application/pdf",
      "size": 12345,
      "content": "base64-encoded-data"
    }
  ]
}
```

### Gmail Setup
1. Enable IMAP in Gmail settings
2. Use app-specific password
3. Use imap.gmail.com:993 with SSL

---

## 🔧 Installation

```bash
cd backend/custom-nodes/email
npm install
```

## 📦 Dependencies

- **nodemailer**: SMTP email sending
- **imap**: IMAP email receiving
- **mailparser**: Email parsing

## 🎯 Why Two Separate Nodes?

1. **Different Protocols**: SMTP (send) vs IMAP (receive)
2. **Different Use Cases**: Outbound vs inbound workflows
3. **Different Credentials**: Separate auth for sending/receiving
4. **Industry Standard**: Follows n8n, Zapier, Make.com patterns
5. **Cleaner UX**: Focused, single-purpose nodes

## 🚀 Common Workflows

**Auto-Reply System:**
```
Email Receive (IMAP) → If (check subject) → Email Send (SMTP)
```

**Email Notification:**
```
Schedule Trigger → HTTP Request → Email Send
```

**Email Processing:**
```
Email Receive → Text Parser → Database Insert
```

## 📝 Notes

- For Gmail, use app-specific passwords (not your main password)
- IMAP search criteria: https://www.rfc-editor.org/rfc/rfc3501#section-6.4.4
- Attachments in Email Send can use `path` or `content` property
- Email Receive returns attachments as base64-encoded strings
