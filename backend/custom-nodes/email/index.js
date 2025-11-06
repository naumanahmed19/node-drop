// Export the node definitions
module.exports = {
  nodes: {
    "emailSend": require("./nodes/email-send.node.js"),
    "emailReceive": require("./nodes/email-receive.node.js"),
  },
  credentials: {
    "smtp": require("./credentials/smtp.credentials.js"),
    "imap": require("./credentials/imap.credentials.js"),
  },
};
