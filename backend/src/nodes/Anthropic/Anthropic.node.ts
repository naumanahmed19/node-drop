import Anthropic from "@anthropic-ai/sdk";
import { AIMessage, ANTHROPIC_MODELS } from "../../types/ai.types";
import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";
import { MemoryManager } from "../../utils/ai/MemoryManager";

export const AnthropicNode: NodeDefinition = {
  identifier: "anthropic",
  displayName: "Anthropic (Claude)",
  name: "anthropic",
  group: ["ai", "transform"],
  version: 1,
  description:
    "Interact with Anthropic Claude models (Claude 3.5 Sonnet, Opus, Haiku)",
  icon: "🧠",
  color: "#D97757",
  defaults: {
    model: "claude-3-5-sonnet-20241022",
    temperature: 0.7,
    maxTokens: 1024,
    enableMemory: false,
    sessionId: "default",
  },
  inputs: ["main"],
  outputs: ["main"],
  credentials: [
    {
      name: "apiKey",
      displayName: "API Key",
      properties: [],
    },
  ],
  properties: [
    {
      displayName: "Authentication",
      name: "authentication",
      type: "credential",
      required: true,
      default: "",
      description: "Select Anthropic API credentials",
      placeholder: "Select credentials...",
      allowedTypes: ["apiKey"],
    },
    {
      displayName: "Model",
      name: "model",
      type: "options",
      required: true,
      default: "claude-3-5-sonnet-20241022",
      description: "The Claude model to use",
      options: Object.entries(ANTHROPIC_MODELS).map(([value, info]) => ({
        name: `${info.name} (${info.contextWindow.toLocaleString()} tokens)`,
        value,
      })),
    },
    {
      displayName: "System Prompt",
      name: "systemPrompt",
      type: "string",
      required: false,
      default: "You are a helpful AI assistant.",
      description: "System instructions for Claude",
      placeholder: "You are a helpful AI assistant that...",
    },
    {
      displayName: "User Message",
      name: "userMessage",
      type: "string",
      required: true,
      default: "",
      description:
        "The message to send to Claude. You can use {{json.fieldName}} to reference input data.",
      placeholder: "Enter your message or use {{json.field}}",
    },
    {
      displayName: "Temperature",
      name: "temperature",
      type: "number",
      required: false,
      default: 0.7,
      description:
        "Controls randomness. Range: 0.0 to 1.0. Higher values make output more random.",
      placeholder: "0.7",
    },
    {
      displayName: "Max Tokens",
      name: "maxTokens",
      type: "number",
      required: false,
      default: 1024,
      description: "Maximum number of tokens to generate in the response",
      placeholder: "1024",
    },
    {
      displayName: "Enable Conversation Memory",
      name: "enableMemory",
      type: "boolean",
      required: false,
      default: false,
      description: "Maintain conversation history across multiple executions",
    },
    {
      displayName: "Session ID",
      name: "sessionId",
      type: "string",
      required: false,
      default: "default",
      description: "Unique identifier for the conversation session",
      placeholder: "user-123-chat",
      displayOptions: {
        show: {
          enableMemory: [true],
        },
      },
    },
  ],
  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    // Get parameters
    const model = this.getNodeParameter("model") as string;
    const systemPrompt = this.getNodeParameter("systemPrompt") as string;
    const userMessage = this.getNodeParameter("userMessage") as string;
    const temperature = this.getNodeParameter("temperature") as number;
    const maxTokens = this.getNodeParameter("maxTokens") as number;
    const enableMemory = this.getNodeParameter("enableMemory") as boolean;
    const sessionId = this.getNodeParameter("sessionId") as string;

    // Get credentials
    const credentials = await this.getCredentials("apiKey");

    if (!credentials || !credentials.apiKey) {
      throw new Error(
        "Anthropic API key is required. Please configure credentials."
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: credentials.apiKey as string,
    });

    // Resolve user message with input data
    const items = this.extractJsonData(
      this.normalizeInputItems(inputData.main || [])
    );
    const resolvedMessage =
      items.length > 0 ? this.resolveValue(userMessage, items[0]) : userMessage;

    if (!resolvedMessage || resolvedMessage.trim() === "") {
      throw new Error("User message cannot be empty");
    }

    // Get memory manager
    const memoryManager = MemoryManager.getInstance();

    // Build messages array
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Add conversation history if memory is enabled
    if (enableMemory) {
      const memory = await memoryManager.getMemory(sessionId);

      // Filter out system messages and convert to Anthropic format
      const conversationMessages = memory.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      messages.push(...conversationMessages);
    }

    // Add current user message
    const currentUserMessage = {
      role: "user" as const,
      content: resolvedMessage,
    };
    messages.push(currentUserMessage);

    // Save user message to memory if enabled
    if (enableMemory) {
      const aiMessage: AIMessage = {
        role: "user",
        content: resolvedMessage,
        timestamp: Date.now(),
      };
      await memoryManager.addMessage(sessionId, aiMessage);
    }

    this.logger.info("Sending request to Anthropic", {
      model,
      messageCount: messages.length,
      sessionId: enableMemory ? sessionId : "none",
      temperature,
      maxTokens,
    });

    try {
      // Make API call
      const response = await anthropic.messages.create({
        model,
        system: systemPrompt || "You are a helpful AI assistant.",
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      // Extract response content
      const assistantMessage = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as any).text)
        .join("\n");

      // Save assistant response to memory if enabled
      if (enableMemory) {
        const assistantAIMessage: AIMessage = {
          role: "assistant",
          content: assistantMessage,
          timestamp: Date.now(),
        };
        await memoryManager.addMessage(sessionId, assistantAIMessage);
      }

      // Calculate estimated cost
      const modelInfo =
        ANTHROPIC_MODELS[model as keyof typeof ANTHROPIC_MODELS];
      const promptTokens = response.usage.input_tokens;
      const completionTokens = response.usage.output_tokens;
      const totalTokens = promptTokens + completionTokens;

      const estimatedCost =
        (promptTokens / 1000) * modelInfo.costPer1kInput +
        (completionTokens / 1000) * modelInfo.costPer1kOutput;

      this.logger.info("Anthropic request completed", {
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost: `$${estimatedCost.toFixed(6)}`,
        stopReason: response.stop_reason,
      });

      // Return output
      return [
        {
          main: [
            {
              json: {
                response: assistantMessage,
                model,
                usage: {
                  promptTokens,
                  completionTokens,
                  totalTokens,
                  estimatedCost,
                },
                stopReason: response.stop_reason,
                sessionId: enableMemory ? sessionId : null,
                conversationLength: enableMemory
                  ? (await memoryManager.getMemory(sessionId)).messages.length
                  : messages.length,
              },
            },
          ],
        },
      ];
    } catch (error: any) {
      this.logger.error("Anthropic request failed", {
        error: error.message,
        model,
        sessionId: enableMemory ? sessionId : "none",
      });

      // Provide helpful error messages
      if (error.status === 401) {
        throw new Error(
          "Invalid Anthropic API key. Please check your credentials."
        );
      } else if (error.status === 429) {
        throw new Error(
          "Anthropic rate limit exceeded. Please try again later."
        );
      } else if (error.status === 500 || error.status === 529) {
        throw new Error("Anthropic service error. Please try again later.");
      } else {
        throw new Error(`Anthropic error: ${error.message}`);
      }
    }
  },
};
