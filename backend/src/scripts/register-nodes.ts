#!/usr/bin/env node
/**
 * Script to automatically register all discovered nodes
 * Run this to register all nodes in the nodes directory without manual configuration
 */

import { PrismaClient } from "@prisma/client";
import { NodeService } from "../services/NodeService";
import { nodeDiscovery } from "../utils/NodeDiscovery";

async function registerAllDiscoveredNodes() {
  const prisma = new PrismaClient();
  const nodeService = new NodeService(prisma);

  try {
    console.log("🔄 Auto-discovering and registering nodes...\n");

    // Auto-discover all nodes
    const nodeDefinitions = await nodeDiscovery.getAllNodeDefinitions();

    if (nodeDefinitions.length === 0) {
      console.log("⚠️  No nodes discovered in the nodes directory");
      return;
    }

    console.log(`📦 Discovered ${nodeDefinitions.length} node(s):\n`);

    // List discovered nodes
    nodeDefinitions.forEach((node, index) => {
      console.log(`   ${index + 1}. ${node.displayName} (${node.identifier})`);
    });

    console.log("\n🔄 Registering nodes...\n");

    let registered = 0;
    let failed = 0;

    for (const node of nodeDefinitions) {
      try {
        const result = await nodeService.registerNode(node);

        if (result.success) {
          console.log(`✅ Registered: ${node.displayName} (${node.identifier})`);
          registered++;
        } else {
          console.error(`❌ Failed: ${node.displayName} (${node.identifier})`);
          result.errors?.forEach((error) => console.error(`   ${error}`));
          failed++;
        }
      } catch (error) {
        console.error(`❌ Error registering ${node.displayName}:`, error);
        failed++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Registered: ${registered}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${nodeDefinitions.length}`);

    // Show nodes grouped by directory
    console.log(`\n📁 Nodes by directory:`);
    const nodesByDir = await nodeDiscovery.getNodesByDirectory();
    for (const [dirName, nodes] of Object.entries(nodesByDir)) {
      console.log(`   ${dirName}/`);
      nodes.forEach((node) => {
        console.log(`     └─ ${node.displayName}`);
      });
    }
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the registration
registerAllDiscoveredNodes()
  .then(() => {
    console.log("\n✅ Auto-registration complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Auto-registration failed:", error);
    process.exit(1);
  });
