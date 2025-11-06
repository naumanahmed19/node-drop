const nodemailer = require("nodemailer");

const EmailSendNode = {
  type: "emailSend",
  displayName: "Email Send",
  name: "emailSend",
  group: ["communication"],
  version: 1,
  description: "Send emails via SMTP",
  icon: "file:icon-send.svg",
  color: "#EA4335",
  defaults: {
    name: "Email Send",
  },
  inputs: ["main"],
  outputs: ["main"],
  credentials: [
    {
      name: "smtp",
      required: true,
    },
  ],
  properties: [
    {
      displayName: "Authentication",
      name: "authentication",
      type: "credential",
      required: true,
      default: "",
      description: "Select SMTP credentials to send emails",
      placeholder: "Select credentials...",
      allowedTypes: ["smtp"],
    },
    {
      displayName: "From Email",
      name: "fromEmail",
      type: "string",
      default: "",
      placeholder: "sender@example.com",
      description: "Sender email address (overrides credential default)",
    },
    {
      displayName: "From Name",
      name: "fromName",
      type: "string",
      default: "",
      placeholder: "John Doe",
      description: "Sender name (overrides credential default)",
    },
    {
      displayName: "To",
      name: "toEmail",
      type: "string",
      default: "",
      required: true,
      placeholder: "recipient@example.com",
      description: "Recipient email address (comma-separated for multiple)",
    },
    {
      displayName: "CC",
      name: "ccEmail",
      type: "string",
      default: "",
      placeholder: "cc@example.com",
      description: "CC email addresses (comma-separated for multiple)",
    },
    {
      displayName: "BCC",
      name: "bccEmail",
      type: "string",
      default: "",
      placeholder: "bcc@example.com",
      description: "BCC email addresses (comma-separated for multiple)",
    },
    {
      displayName: "Subject",
      name: "subject",
      type: "string",
      default: "",
      required: true,
      placeholder: "Email Subject",
      description: "Email subject line",
    },
    {
      displayName: "Email Type",
      name: "emailType",
      type: "options",
      default: "text",
      options: [
        {
          name: "Text",
          value: "text",
          description: "Plain text email",
        },
        {
          name: "HTML",
          value: "html",
          description: "HTML formatted email",
        },
      ],
      description: "Type of email content",
    },
    {
      displayName: "Message",
      name: "message",
      type: "string",
      default: "",
      required: true,
      placeholder: "Email message content...",
      description: "Email message body",
    },
    {
      displayName: "Attachments",
      name: "attachments",
      type: "json",
      default: "[]",
      placeholder: '[{"filename": "file.txt", "content": "data"}]',
      description: "Array of attachment objects with filename and content/path",
    },
  ],

  async execute(inputData) {
    const items = inputData.main?.[0] || [];
    const results = [];

    // If no input items, create a default item to ensure email sends at least once
    const itemsToProcess = items.length > 0 ? items : [{ json: {} }];

    // Get credentials using the context method
    const credentials = await this.getCredentials("smtp");

    if (!credentials) {
      throw new Error("SMTP credentials are required");
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure || false,
      auth: {
        user: credentials.user,
        pass: credentials.password,
      },
    });

    // Get node parameters
    const fromEmail = this.getNodeParameter("fromEmail") || credentials.fromEmail || credentials.user;
    const fromName = this.getNodeParameter("fromName") || credentials.fromName || "";
    const toEmail = this.getNodeParameter("toEmail");
    const ccEmail = this.getNodeParameter("ccEmail");
    const bccEmail = this.getNodeParameter("bccEmail");
    const subject = this.getNodeParameter("subject");
    const emailType = this.getNodeParameter("emailType");
    const message = this.getNodeParameter("message");
    const attachmentsParam = this.getNodeParameter("attachments");

    // Process each input item
    for (const item of itemsToProcess) {
      try {
        const data = item.json || {};

        // Determine from address
        const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;

        // Parse attachments if provided
        let attachments = [];
        if (attachmentsParam) {
          try {
            attachments = typeof attachmentsParam === "string"
              ? JSON.parse(attachmentsParam)
              : attachmentsParam;
          } catch (e) {
            console.warn("Failed to parse attachments:", e.message);
          }
        }

        // Build email options
        const mailOptions = {
          from: from,
          to: toEmail,
          subject: subject,
          [emailType]: message,
        };

        if (ccEmail) {
          mailOptions.cc = ccEmail;
        }

        if (bccEmail) {
          mailOptions.bcc = bccEmail;
        }

        if (attachments.length > 0) {
          mailOptions.attachments = attachments;
        }

        // Send email
        const info = await transporter.sendMail(mailOptions);

        results.push({
          json: {
            success: true,
            messageId: info.messageId,
            response: info.response,
            accepted: info.accepted,
            rejected: info.rejected,
            to: toEmail,
            subject: subject,
            ...data,
          },
        });
      } catch (error) {
        results.push({
          json: {
            success: false,
            error: error.message,
            to: toEmail,
            subject: subject,
          },
        });
      }
    }

    return [{ main: results }];
  },
};

module.exports = EmailSendNode;
