const SMTPCredentials = {
  name: "smtp",
  displayName: "SMTP",
  documentationUrl: "",
  testable: true,
  properties: [
    {
      displayName: "Host",
      name: "host",
      type: "text",
      default: "",
      required: true,
      placeholder: "smtp.gmail.com",
      description: "SMTP server hostname",
    },
    {
      displayName: "Port",
      name: "port",
      type: "number",
      default: 587,
      required: true,
      description: "SMTP server port (587 for TLS, 465 for SSL, 25 for non-secure)",
    },
    {
      displayName: "Secure Connection",
      name: "secure",
      type: "boolean",
      default: false,
      description: "Use SSL/TLS (port 465). For STARTTLS (port 587), leave unchecked.",
    },
    {
      displayName: "Username",
      name: "user",
      type: "text",
      default: "",
      required: true,
      placeholder: "your-email@gmail.com",
      description: "SMTP username (usually your email address)",
    },
    {
      displayName: "Password",
      name: "password",
      type: "password",
      default: "",
      required: true,
      description: "SMTP password or app-specific password",
    },
    {
      displayName: "From Name",
      name: "fromName",
      type: "text",
      default: "",
      placeholder: "John Doe",
      description: "Default sender name (optional)",
    },
    {
      displayName: "From Email",
      name: "fromEmail",
      type: "text",
      default: "",
      placeholder: "sender@example.com",
      description: "Default sender email address (optional, uses username if not set)",
    },
  ],

  /**
   * Test the SMTP connection
   */
  async test(data) {
    // Validate required fields
    if (!data.host || !data.user || !data.password) {
      return {
        success: false,
        message: "Host, username, and password are required",
      };
    }

    try {
      const nodemailer = require("nodemailer");

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: data.host,
        port: data.port || 587,
        secure: data.secure || false,
        auth: {
          user: data.user,
          pass: data.password,
        },
        connectionTimeout: 10000, // 10 second timeout
      });

      // Verify connection
      await transporter.verify();

      return {
        success: true,
        message: `Connected successfully to SMTP server ${data.host}:${data.port || 587}`,
      };
    } catch (error) {
      // Handle specific SMTP errors
      if (error.code === "ECONNREFUSED") {
        return {
          success: false,
          message: `Cannot connect to SMTP server at ${data.host}:${data.port || 587}. Connection refused.`,
        };
      } else if (error.code === "ENOTFOUND") {
        return {
          success: false,
          message: `Cannot resolve host: ${data.host}. Please check the hostname.`,
        };
      } else if (error.code === "ETIMEDOUT") {
        return {
          success: false,
          message: `Connection timeout to ${data.host}:${data.port || 587}. Please check firewall and network settings.`,
        };
      } else if (error.code === "EAUTH" || error.responseCode === 535) {
        return {
          success: false,
          message: "Authentication failed. Invalid username or password.",
        };
      } else if (error.code === "ESOCKET") {
        return {
          success: false,
          message: "Socket error. Please check SSL/TLS settings.",
        };
      } else {
        return {
          success: false,
          message: `Connection failed: ${error.message || "Unknown error"}`,
        };
      }
    }
  },
};

module.exports = SMTPCredentials;
