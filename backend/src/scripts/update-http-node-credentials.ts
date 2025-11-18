import { PrismaClient } from "@prisma/client";
import { HttpRequestNode } from "../nodes/HttpRequest/HttpRequest.node";

const prisma = new PrismaClient();

async function updateHttpNodeCredentials() {
  try {
    console.log("Updating HTTP Request node with credential selector...");

    // Update the HTTP Request node type in the database
    const updated = await prisma.nodeType.update({
      where: {
        identifier: HttpRequestNode.identifier,
      },
      data: {
        credentials: HttpRequestNode.credentials as any,
        credentialSelector: HttpRequestNode.credentialSelector as any,
      },
    });

    console.log("✅ Successfully updated HTTP Request node");
    console.log("Credentials:", JSON.stringify(updated.credentials, null, 2));
    console.log(
      "Credential Selector:",
      JSON.stringify(updated.credentialSelector, null, 2)
    );
  } catch (error) {
    console.error("❌ Failed to update HTTP Request node:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateHttpNodeCredentials();
