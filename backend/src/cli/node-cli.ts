#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";
import { Command } from "commander";
import { promises as fs } from "fs";
import * as path from "path";
import { CredentialService } from "../services/CredentialService";
import { NodeLoader } from "../services/NodeLoader";
import { NodeService } from "../services/NodeService";
import {
  NodeTemplateGenerator,
  NodeTemplateOptions,
} from "../services/NodeTemplateGenerator";

const program = new Command();

program
  .name("nd-node-cli")
  .description("CLI tool for nodeDrop custom node development")
  .version("1.0.0");

// Create command
program
  .command("create")
  .description("Create a new node from template")
  .option(
    "-t, --type <type>",
    "Node type (action, trigger, transform)",
    "action"
  )
  .option("-n, --name <name>", "Node name (required)")
  .option("-d, --display-name <displayName>", "Display name for the node")
  .option("--description <description>", "Node description")
  .option("-a, --author <author>", "Author name")
  .option("-v, --version <version>", "Node version", "1.0.0")
  .option("-g, --group <group>", "Node group (comma-separated)", "transform")
  .option("--credentials", "Include credentials template", false)
  .option("--tests", "Include test files", true)
  .option("--typescript", "Use TypeScript", true)
  .option("-o, --output <output>", "Output directory", process.cwd())
  .action(async (options) => {
    try {
      if (!options.name) {
        console.error(
          "Error: Node name is required. Use -n or --name to specify."
        );
        process.exit(1);
      }

      const templateOptions: NodeTemplateOptions = {
        name: options.name,
        displayName: options.displayName || options.name,
        description: options.description || `Custom ${options.name} node`,
        type: options.type,
        author: options.author,
        version: options.version,
        group: options.group.split(",").map((g: string) => g.trim()),
        includeCredentials: options.credentials,
        includeTests: options.tests,
        typescript: options.typescript,
      };

      const generator = new NodeTemplateGenerator();
      const result = await generator.generateNodePackage(
        options.output,
        templateOptions
      );

      if (result.success) {
        console.log(
          `✅ Node package created successfully at: ${result.packagePath}`
        );

        if (result.warnings && result.warnings.length > 0) {
          console.log("\n⚠️  Warnings:");
          result.warnings.forEach((warning) => console.log(`   ${warning}`));
        }

        console.log("\n📝 Next steps:");
        console.log(
          `   cd ${path.relative(process.cwd(), result.packagePath!)}`
        );
        console.log("   npm install");
        if (templateOptions.typescript) {
          console.log("   npm run build");
        }
        if (templateOptions.includeTests) {
          console.log("   npm test");
        }
      } else {
        console.error("❌ Failed to create node package:");
        result.errors?.forEach((error) => console.error(`   ${error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Unexpected error:", error);
      process.exit(1);
    }
  });

// Validate command
program
  .command("validate")
  .description("Validate a node package")
  .argument("<path>", "Path to the node package")
  .action(async (packagePath) => {
    try {
      const absolutePath = path.resolve(packagePath);

      // Create temporary services for validation
      const prisma = new PrismaClient();
      const nodeService = new NodeService(prisma);
      const credentialService = new CredentialService();
      const nodeLoader = new NodeLoader(nodeService, credentialService, prisma);

      const result = await nodeLoader.validateNodePackage(absolutePath);

      if (result.valid) {
        console.log("✅ Node package is valid");

        if (result.packageInfo) {
          console.log("\n📦 Package Info:");
          console.log(`   Name: ${result.packageInfo.name}`);
          console.log(`   Version: ${result.packageInfo.version}`);
          console.log(`   Description: ${result.packageInfo.description}`);
          console.log(`   Nodes: ${result.packageInfo.nodes.length}`);
          if (result.packageInfo.credentials) {
            console.log(
              `   Credentials: ${result.packageInfo.credentials.length}`
            );
          }
        }

        if (result.warnings.length > 0) {
          console.log("\n⚠️  Warnings:");
          result.warnings.forEach((warning) => console.log(`   ${warning}`));
        }
      } else {
        console.error("❌ Node package validation failed:");
        result.errors.forEach((error) => console.error(`   ${error}`));

        if (result.warnings.length > 0) {
          console.log("\n⚠️  Warnings:");
          result.warnings.forEach((warning) => console.log(`   ${warning}`));
        }

        process.exit(1);
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error("❌ Validation error:", error);
      process.exit(1);
    }
  });

// Build command
program
  .command("build")
  .description("Build a node package (compile TypeScript)")
  .argument("<path>", "Path to the node package")
  .action(async (packagePath) => {
    try {
      const absolutePath = path.resolve(packagePath);

      // Create temporary services for building
      const prisma = new PrismaClient();
      const nodeService = new NodeService(prisma);
      const credentialService = new CredentialService();
      const nodeLoader = new NodeLoader(nodeService, credentialService, prisma);

      console.log("🔨 Building node package...");

      const result = await nodeLoader.compileNodePackage(absolutePath);

      if (result.success) {
        console.log("✅ Node package built successfully");

        if (result.compiledPath) {
          console.log(`   Output: ${result.compiledPath}`);
        }

        if (result.warnings && result.warnings.length > 0) {
          console.log("\n⚠️  Warnings:");
          result.warnings.forEach((warning) => console.log(`   ${warning}`));
        }
      } else {
        console.error("❌ Build failed:");
        result.errors?.forEach((error) => console.error(`   ${error}`));

        if (result.warnings && result.warnings.length > 0) {
          console.log("\n⚠️  Warnings:");
          result.warnings.forEach((warning) => console.log(`   ${warning}`));
        }

        process.exit(1);
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error("❌ Build error:", error);
      process.exit(1);
    }
  });

// Test command
program
  .command("test")
  .description("Test a node with sample data")
  .argument("<path>", "Path to the node package")
  .option("-i, --input <input>", "Input data file (JSON)")
  .option("-p, --params <params>", "Node parameters (JSON)")
  .option("-c, --credentials <credentials>", "Credentials (JSON)")
  .action(async (packagePath, options) => {
    try {
      const absolutePath = path.resolve(packagePath);

      // Create services for testing
      const prisma = new PrismaClient();
      const nodeService = new NodeService(prisma);
      const credentialService = new CredentialService();
      const nodeLoader = new NodeLoader(nodeService, credentialService, prisma);

      console.log("🧪 Testing node package...");

      // Load the package
      const loadResult = await nodeLoader.loadNodePackage(absolutePath);
      if (!loadResult.success) {
        console.error("❌ Failed to load node package:");
        loadResult.errors?.forEach((error) => console.error(`   ${error}`));
        process.exit(1);
      }

      // Parse input data
      let inputData = { main: [[{ json: { test: "data" } }]] };
      if (options.input) {
        const inputFile = path.resolve(options.input);
        const inputContent = await fs.readFile(inputFile, "utf-8");
        inputData = JSON.parse(inputContent);
      }

      // Parse parameters
      let parameters = {};
      if (options.params) {
        parameters = JSON.parse(options.params);
      }

      // Parse credentials
      let credentials = {};
      if (options.credentials) {
        credentials = JSON.parse(options.credentials);
      }

      // Get the first node type from the package
      const validation = await nodeLoader.validateNodePackage(absolutePath);
      if (!validation.valid || !validation.packageInfo) {
        console.error("❌ Invalid package");
        process.exit(1);
      }

      // Load node definition to get the type
      const nodeDefinition = await nodeLoader["loadSingleNodeDefinition"](
        path.join(absolutePath, validation.packageInfo.nodes[0])
      );

      if (!nodeDefinition) {
        console.error("❌ Failed to load node definition");
        process.exit(1);
      }

      // Execute the node
      console.log(`   Executing node: ${nodeDefinition.identifier}`);
      const result = await nodeService.executeNode(
        nodeDefinition.identifier,
        parameters,
        inputData,
        credentials
      );

      if (result.success) {
        console.log("✅ Node executed successfully");
        console.log("\n📤 Output:");
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        console.error("❌ Node execution failed:");
        console.error(`   ${result.error?.message}`);
        if (result.error?.stack) {
          console.error(`   Stack: ${result.error.stack}`);
        }
        process.exit(1);
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error("❌ Test error:", error);
      process.exit(1);
    }
  });

// List command
program
  .command("list")
  .description("List all loaded custom nodes")
  .action(async () => {
    try {
      const prisma = new PrismaClient();
      const nodeService = new NodeService(prisma);
      const credentialService = new CredentialService();
      const nodeLoader = new NodeLoader(nodeService, credentialService, prisma);

      await nodeLoader.initialize();

      const packages = nodeLoader.getLoadedPackages();

      if (packages.length === 0) {
        console.log("📦 No custom node packages loaded");
      } else {
        console.log(`📦 Loaded custom node packages (${packages.length}):`);
        packages.forEach((pkg) => {
          console.log(`   ${pkg.name} v${pkg.version}`);
          console.log(`     Description: ${pkg.description}`);
          console.log(`     Nodes: ${pkg.nodes.length}`);
          if (pkg.credentials) {
            console.log(`     Credentials: ${pkg.credentials.length}`);
          }
          console.log("");
        });
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error("❌ List error:", error);
      process.exit(1);
    }
  });

// Install command
program
  .command("install")
  .description("Install a node package")
  .argument("<path>", "Path to the node package")
  .action(async (packagePath) => {
    try {
      const absolutePath = path.resolve(packagePath);

      const prisma = new PrismaClient();
      const nodeService = new NodeService(prisma);
      const credentialService = new CredentialService();
      const nodeLoader = new NodeLoader(nodeService, credentialService, prisma);

      await nodeLoader.initialize();

      console.log("📦 Installing node package...");

      const result = await nodeLoader.loadNodePackage(absolutePath);

      if (result.success) {
        console.log("✅ Node package installed successfully");

        if (result.warnings && result.warnings.length > 0) {
          console.log("\n⚠️  Warnings:");
          result.warnings.forEach((warning) => console.log(`   ${warning}`));
        }
      } else {
        console.error("❌ Installation failed:");
        result.errors?.forEach((error) => console.error(`   ${error}`));
        process.exit(1);
      }

      await prisma.$disconnect();
    } catch (error) {
      console.error("❌ Installation error:", error);
      process.exit(1);
    }
  });

// Uninstall command
program
  .command("uninstall")
  .description("Uninstall a node package")
  .argument("<name>", "Name of the node package")
  .action(async (packageName) => {
    try {
      const prisma = new PrismaClient();
      const nodeService = new NodeService(prisma);
      const credentialService = new CredentialService();
      const nodeLoader = new NodeLoader(nodeService, credentialService, prisma);

      await nodeLoader.initialize();

      console.log(`📦 Uninstalling node package: ${packageName}`);

      await nodeLoader.unloadNodePackage(packageName);

      console.log("✅ Node package uninstalled successfully");

      await prisma.$disconnect();
    } catch (error) {
      console.error("❌ Uninstall error:", error);
      process.exit(1);
    }
  });

// Dev command (watch mode)
program
  .command("dev")
  .description("Start development mode with hot reload")
  .argument("<path>", "Path to the node package")
  .action(async (packagePath) => {
    try {
      const absolutePath = path.resolve(packagePath);

      const prisma = new PrismaClient();
      const nodeService = new NodeService(prisma);
      const credentialService = new CredentialService();
      const nodeLoader = new NodeLoader(nodeService, credentialService, prisma);

      // Enable hot reload
      process.env.NODE_ENV = "development";

      await nodeLoader.initialize();

      console.log("🔥 Starting development mode with hot reload...");
      console.log(`   Watching: ${absolutePath}`);
      console.log("   Press Ctrl+C to stop");

      const result = await nodeLoader.loadNodePackage(absolutePath);

      if (result.success) {
        console.log("✅ Node package loaded in development mode");
        console.log("   File changes will trigger automatic reload");

        // Keep the process running
        process.on("SIGINT", async () => {
          console.log("\n🛑 Stopping development mode...");
          await nodeLoader.cleanup();
          await prisma.$disconnect();
          process.exit(0);
        });

        // Keep alive
        setInterval(() => {}, 1000);
      } else {
        console.error("❌ Failed to start development mode:");
        result.errors?.forEach((error) => console.error(`   ${error}`));
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Development mode error:", error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
