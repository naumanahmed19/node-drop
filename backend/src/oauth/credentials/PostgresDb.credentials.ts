import { CredentialType, CredentialData } from "../../services/CredentialService";

/**
 * PostgreSQL Database Credential
 * Can be used by any node that needs to connect to PostgreSQL
 */
export const PostgresDbCredentials: CredentialType = {
  name: "postgresDb",
  displayName: "PostgreSQL Database",
  description: "PostgreSQL database connection credentials",
  icon: "🐘",
  color: "#336791",
  testable: true,
  properties: [
    {
      displayName: "Host",
      name: "host",
      type: "string",
      required: true,
      default: "localhost",
      description: "PostgreSQL server host",
      placeholder: "localhost or IP address",
    },
    {
      displayName: "Port",
      name: "port",
      type: "number",
      required: true,
      default: 5432,
      description: "PostgreSQL server port",
    },
    {
      displayName: "Database",
      name: "database",
      type: "string",
      required: true,
      default: "",
      description: "Database name",
      placeholder: "my_database",
    },
    {
      displayName: "User",
      name: "user",
      type: "string",
      required: true,
      default: "",
      description: "Database user",
      placeholder: "postgres",
    },
    {
      displayName: "Password",
      name: "password",
      type: "password",
      required: true,
      default: "",
      description: "Database password",
    },
    {
      displayName: "SSL",
      name: "ssl",
      type: "boolean",
      default: false,
      description: "Use SSL connection",
    },
  ],

  /**
   * Test the PostgreSQL connection
   */
  async test(data: CredentialData) {
    try {
      // Validate required fields
      if (!data.host || !data.database || !data.user || !data.password) {
        return {
          success: false,
          message: "Host, database, user, and password are required",
        };
      }

      // Try to connect to PostgreSQL
      try {
        const { Pool } = require("pg");

        const pool = new Pool({
          host: data.host,
          port: data.port || 5432,
          database: data.database,
          user: data.user,
          password: data.password,
          ssl: data.ssl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 5000, // 5 second timeout
          max: 1, // Only create 1 connection for testing
        });

        try {
          // Test the connection with a simple query
          const result = await pool.query(
            "SELECT NOW() as current_time, version() as version"
          );
          await pool.end();

          if (result.rows && result.rows.length > 0) {
            const version = result.rows[0].version;
            // Extract just the PostgreSQL version number
            const versionMatch = version.match(/PostgreSQL ([\d.]+)/);
            const versionStr = versionMatch ? versionMatch[1] : "Unknown";

            return {
              success: true,
              message: `Connected successfully to PostgreSQL ${versionStr} at ${
                data.host
              }:${data.port || 5432}/${data.database}`,
            };
          }

          await pool.end();
          return {
            success: true,
            message: "Connection successful",
          };
        } catch (queryError) {
          await pool.end();
          throw queryError;
        }
      } catch (error: any) {
        // Handle specific PostgreSQL error codes
        if (error.code === "ECONNREFUSED") {
          return {
            success: false,
            message: `Cannot connect to database server at ${data.host}:${
              data.port || 5432
            }. Connection refused.`,
          };
        } else if (error.code === "ENOTFOUND") {
          return {
            success: false,
            message: `Cannot resolve host: ${data.host}. Please check the hostname.`,
          };
        } else if (error.code === "ETIMEDOUT") {
          return {
            success: false,
            message: `Connection timeout to ${data.host}:${
              data.port || 5432
            }. Please check firewall and network settings.`,
          };
        } else if (error.code === "28P01") {
          return {
            success: false,
            message: "Authentication failed. Invalid username or password.",
          };
        } else if (error.code === "3D000") {
          return {
            success: false,
            message: `Database "${data.database}" does not exist.`,
          };
        } else if (error.code === "28000") {
          return {
            success: false,
            message:
              "Authorization failed. User does not have access to this database.",
          };
        } else if (error.code === "08001") {
          return {
            success: false,
            message:
              "Unable to establish connection. Please check server settings.",
          };
        } else {
          return {
            success: false,
            message: `Connection failed: ${error.message || "Unknown error"}`,
          };
        }
      }
    } catch (error: any) {
      return {
        success: false,
        message: `Validation failed: ${error.message || "Unknown error"}`
      };
    }
  }
};
