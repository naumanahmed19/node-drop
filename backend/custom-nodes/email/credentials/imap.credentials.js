const IMAPCredentials = {
  name: "imap",
  displayName: "IMAP",
  documentationUrl: "",
  testable: true,
  properties: [
    {
      displayName: "Host",
      name: "host",
      type: "text",
      default: "",
      required: true,
      placeholder: "imap.gmail.com",
      description: "IMAP server hostname",
    },
    {
      displayName: "Port",
      name: "port",
      type: "number",
      default: 993,
      required: true,
      description: "IMAP server port (993 for SSL, 143 for non-secure)",
    },
    {
      displayName: "Secure Connection",
      name: "tls",
      type: "boolean",
      default: true,
      description: "Use SSL/TLS connection",
    },
    {
      displayName: "Username",
      name: "user",
      type: "text",
      default: "",
      required: true,
      placeholder: "your-email@gmail.com",
      description: "IMAP username (usually your email address)",
    },
    {
      displayName: "Password",
      name: "password",
      type: "password",
      default: "",
      required: true,
      description: "IMAP password or app-specific password",
    },
  ],

  /**
   * Test the IMAP connection
   */
  async test(data) {
    // Validate required fields
    if (!data.host || !data.user || !data.password) {
      return {
        success: false,
        message: "Host, username, and password are required",
      };
    }

    return new Promise((resolve) => {
      try {
        const Imap = require("imap");

        const imap = new Imap({
          user: data.user,
          password: data.password,
          host: data.host,
          port: data.port || 993,
          tls: data.tls !== false,
          tlsOptions: { rejectUnauthorized: false },
          connTimeout: 10000, // 10 second timeout
          authTimeout: 10000,
        });

        let resolved = false;

        imap.once("ready", () => {
          if (!resolved) {
            resolved = true;
            imap.end();
            resolve({
              success: true,
              message: `Connected successfully to IMAP server ${data.host}:${data.port || 993}`,
            });
          }
        });

        imap.once("error", (error) => {
          if (!resolved) {
            resolved = true;

            // Handle specific IMAP errors
            const errorMsg = error.message || error.toString();

            if (errorMsg.includes("ECONNREFUSED")) {
              resolve({
                success: false,
                message: `Cannot connect to IMAP server at ${data.host}:${data.port || 993}. Connection refused.`,
              });
            } else if (errorMsg.includes("ENOTFOUND")) {
              resolve({
                success: false,
                message: `Cannot resolve host: ${data.host}. Please check the hostname.`,
              });
            } else if (errorMsg.includes("ETIMEDOUT") || errorMsg.includes("timeout")) {
              resolve({
                success: false,
                message: `Connection timeout to ${data.host}:${data.port || 993}. Please check firewall and network settings.`,
              });
            } else if (errorMsg.includes("Invalid credentials") || errorMsg.includes("authentication failed") || errorMsg.includes("AUTHENTICATIONFAILED")) {
              resolve({
                success: false,
                message: "Authentication failed. Invalid username or password.",
              });
            } else if (errorMsg.includes("certificate") || errorMsg.includes("SSL") || errorMsg.includes("TLS")) {
              resolve({
                success: false,
                message: "SSL/TLS error. Please check secure connection settings.",
              });
            } else {
              resolve({
                success: false,
                message: `Connection failed: ${errorMsg}`,
              });
            }
          }
        });

        imap.once("end", () => {
          if (!resolved) {
            resolved = true;
            resolve({
              success: true,
              message: "Connection successful",
            });
          }
        });

        // Set a timeout in case nothing happens
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            imap.end();
            resolve({
              success: false,
              message: "Connection timeout. Please check your settings.",
            });
          }
        }, 15000); // 15 second overall timeout

        imap.connect();
      } catch (error) {
        resolve({
          success: false,
          message: `Connection failed: ${error.message || "Unknown error"}`,
        });
      }
    });
  },
};

module.exports = IMAPCredentials;
