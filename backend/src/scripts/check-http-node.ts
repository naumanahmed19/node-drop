import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkHttpNode() {
  try {
    console.log("Checking HTTP Request node in database...");

    const httpNode = await prisma.nodeType.findUnique({
      where: {
        identifier: "http-request",
      },
    });

    if (!httpNode) {
      console.log("❌ HTTP Request node not found in database");
      return;
    }

    console.log("\n✅ HTTP Request node found");
    console.log("\nIdentifier:", httpNode.identifier);
    console.log("DisplayName:", httpNode.displayName);
    console.log(
      "\nCredentials field exists:",
      httpNode.credentials !== null && httpNode.credentials !== undefined
    );
    console.log(
      "Credentials value:",
      httpNode.credentials ? "Present" : "Missing"
    );
    console.log(
      "\nCredentialSelector field exists:",
      httpNode.credentialSelector !== null &&
        httpNode.credentialSelector !== undefined
    );
    console.log(
      "CredentialSelector value:",
      httpNode.credentialSelector ? "Present" : "Missing"
    );

    if (httpNode.credentialSelector) {
      console.log(
        "\nCredentialSelector content:",
        JSON.stringify(httpNode.credentialSelector, null, 2)
      );
    }

    if (httpNode.credentials) {
      console.log(
        "\nCredentials content (first item):",
        JSON.stringify(
          Array.isArray(httpNode.credentials)
            ? httpNode.credentials[0]
            : httpNode.credentials,
          null,
          2
        )
      );
    }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkHttpNode();
