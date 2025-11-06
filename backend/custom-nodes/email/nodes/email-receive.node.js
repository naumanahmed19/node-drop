const Imap = require("imap");
const { simpleParser } = require("mailparser");

/**
 * Helper function to fetch emails from IMAP server
 */
function fetchEmails(imapConfig, options) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);
    const emails = [];

    imap.once("ready", () => {
      imap.openBox(options.mailbox, options.readOnly, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        // Build search criteria
        const searchCriteria = options.filters || ["ALL"];
        const fetchOptions = {
          bodies: "",
          markSeen: options.markAsRead,
        };

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (results.length === 0) {
            imap.end();
            return resolve([]);
          }

          // Limit results if specified
          const limitedResults = options.limit
            ? results.slice(-options.limit)
            : results;

          const fetch = imap.fetch(limitedResults, fetchOptions);

          fetch.on("message", (msg) => {
            let buffer = "";

            msg.on("body", (stream) => {
              stream.on("data", (chunk) => {
                buffer += chunk.toString("utf8");
              });
            });

            msg.once("end", () => {
              simpleParser(buffer, (err, parsed) => {
                if (err) {
                  console.error("Error parsing email:", err);
                  return;
                }

                emails.push({
                  messageId: parsed.messageId,
                  from: parsed.from?.text || "",
                  to: parsed.to?.text || "",
                  subject: parsed.subject || "",
                  date: parsed.date,
                  text: parsed.text || "",
                  html: parsed.html || "",
                  attachments: parsed.attachments?.map((att) => ({
                    filename: att.filename,
                    contentType: att.contentType,
                    size: att.size,
                    content: att.content?.toString("base64"),
                  })) || [],
                  headers: parsed.headers,
                });
              });
            });
          });

          fetch.once("error", (err) => {
            imap.end();
            reject(err);
          });

          fetch.once("end", () => {
            imap.end();
          });
        });
      });
    });

    imap.once("error", (err) => {
      reject(err);
    });

    imap.once("end", () => {
      resolve(emails);
    });

    imap.connect();
  });
}

const EmailReceiveNode = {
  type: "emailReceive",
  displayName: "Email Receive",
  name: "emailReceive",
  group: ["communication"],
  version: 1,
  description: "Receive and read emails via IMAP",
  icon: "file:icon.svg",
  color: "#4285F4",
  defaults: {
    name: "Email Receive",
  },
  inputs: ["main"],
  outputs: ["main"],
  credentials: [
    {
      name: "imap",
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
      description: "Select IMAP credentials to receive emails",
      placeholder: "Select credentials...",
      allowedTypes: ["imap"],
    },
    {
      displayName: "Mailbox",
      name: "mailbox",
      type: "string",
      default: "INBOX",
      required: true,
      placeholder: "INBOX",
      description: "Mailbox to read from (INBOX, Sent, Drafts, etc.)",
    },
    {
      displayName: "Filter",
      name: "filter",
      type: "options",
      default: "all",
      options: [
        {
          name: "All",
          value: "all",
          description: "Fetch all emails",
        },
        {
          name: "Unseen",
          value: "unseen",
          description: "Fetch only unread emails",
        },
        {
          name: "Seen",
          value: "seen",
          description: "Fetch only read emails",
        },
        {
          name: "Flagged",
          value: "flagged",
          description: "Fetch flagged/starred emails",
        },
        {
          name: "Custom",
          value: "custom",
          description: "Use custom search criteria",
        },
      ],
      description: "Filter emails to fetch",
    },
    {
      displayName: "Custom Criteria",
      name: "customCriteria",
      type: "json",
      default: '["ALL"]',
      displayOptions: {
        show: {
          filter: ["custom"],
        },
      },
      placeholder: '["UNSEEN", ["SINCE", "May 20, 2024"]]',
      description: "IMAP search criteria array (e.g., UNSEEN, FROM, SUBJECT)",
    },
    {
      displayName: "Limit",
      name: "limit",
      type: "number",
      default: 10,
      placeholder: "10",
      description: "Maximum number of emails to fetch (0 for all)",
    },
    {
      displayName: "Mark as Read",
      name: "markAsRead",
      type: "boolean",
      default: false,
      description: "Mark fetched emails as read",
    },
    {
      displayName: "Read Only",
      name: "readOnly",
      type: "boolean",
      default: true,
      description: "Open mailbox in read-only mode",
    },
  ],

  async execute(inputData) {
    // Get credentials using the context method
    const credentials = await this.getCredentials("imap");

    if (!credentials) {
      throw new Error("IMAP credentials are required");
    }

    // Build IMAP config
    const imapConfig = {
      user: credentials.user,
      password: credentials.password,
      host: credentials.host,
      port: credentials.port,
      tls: credentials.tls !== false,
      tlsOptions: { rejectUnauthorized: false },
    };

    // Get node parameters
    const filter = this.getNodeParameter("filter");
    const customCriteria = this.getNodeParameter("customCriteria");
    const mailbox = this.getNodeParameter("mailbox") || "INBOX";
    const limit = this.getNodeParameter("limit") || 0;
    const markAsRead = this.getNodeParameter("markAsRead") || false;
    const readOnly = this.getNodeParameter("readOnly") !== false;

    // Build search criteria based on filter
    let searchCriteria = ["ALL"];
    switch (filter) {
      case "unseen":
        searchCriteria = ["UNSEEN"];
        break;
      case "seen":
        searchCriteria = ["SEEN"];
        break;
      case "flagged":
        searchCriteria = ["FLAGGED"];
        break;
      case "custom":
        try {
          searchCriteria = typeof customCriteria === "string"
            ? JSON.parse(customCriteria)
            : customCriteria;
        } catch (e) {
          throw new Error(`Invalid custom criteria: ${e.message}`);
        }
        break;
    }

    // Fetch options
    const options = {
      mailbox: mailbox,
      filters: searchCriteria,
      limit: limit,
      markAsRead: markAsRead,
      readOnly: readOnly,
    };

    try {
      const emails = await fetchEmails(imapConfig, options);

      const results = emails.map((email) => ({
        json: email,
      }));

      return [{ main: results }];
    } catch (error) {
      throw new Error(`Failed to fetch emails: ${error.message}`);
    }
  },
};

module.exports = EmailReceiveNode;
