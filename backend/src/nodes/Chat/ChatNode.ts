import {
  NodeDefinition,
  NodeInputData,
  NodeOutputData,
} from "../../types/node.types";

export const ChatNode: NodeDefinition = {
  identifier: "chat",
  displayName: "Chat",
  name: "chat",
  group: ["communication", "ai"],
  version: 1,
  description:
    "Interactive chat interface - Send messages and trigger workflows. Can be used as a trigger or accept input from other nodes.",
  icon: "lucide:message-circle",
  color: "#3b82f6",
  executionCapability: "trigger",
  defaults: {
    name: "AI Chat",
  },
  inputs: [],
  outputs: ["main"],
  credentials: [
    {
      name: "openaiApi",
      displayName: "OpenAI API",
      properties: [],
    },
    {
      name: "anthropicApi",
      displayName: "Anthropic API",
      properties: [],
    },
  ],
  properties: [
    {
      displayName: "Accept Input from Other Nodes",
      name: "acceptInput",
      type: "boolean",
      default: false,
      description:
        "When enabled, this node can receive data from previous nodes in the workflow",
    },
    {
      displayName: "Chat URL",
      name: "chatUrl",
      type: "custom",
      required: false,
      default: "",
      description: "Generated public URL for accessing the chat widget",
      component: "UrlGenerator",
      componentProps: {
        mode: "production",
        urlType: "chat",
      },
    },
    {
      displayName: "Widget Embed Code",
      name: "widgetEmbedCode",
      type: "custom",
      required: false,
      default: "",
      description: "Get embed code to add this chat widget to any website",
      component: "WidgetEmbedGenerator",
      componentProps: {
        dependsOn: ["chatUrl"],
        widgetType: "chat"
      },
    },
    {
      displayName: "Chat Title",
      name: "chatTitle",
      type: "string",
      default: "AI Assistant",
      required: true,
      description: "Title displayed in the chat widget header",
    },
    {
      displayName: "Chat Description",
      name: "chatDescription",
      type: "string",
      default: "",
      description: "Description shown in the chat widget",
    },
    {
      displayName: "Welcome Message",
      name: "welcomeMessage",
      type: "string",
      default: "Hello! How can I help you today?",
      description: "Initial message shown when chat opens",
    },
    {
      displayName: "Placeholder Text",
      name: "placeholderText",
      type: "string",
      default: "Type your message...",
      description: "Placeholder text for the message input field",
    },
    {
      displayName: "Widget Theme",
      name: "widgetTheme",
      type: "options",
      options: [
        {
          name: "Light",
          value: "light",
        },
        {
          name: "Dark",
          value: "dark",
        },
        {
          name: "Auto",
          value: "auto",
        },
      ],
      default: "light",
      description: "Theme for the chat widget",
    },
    {
      displayName: "Widget Position",
      name: "widgetPosition",
      type: "options",
      options: [
        {
          name: "Bottom Right",
          value: "bottom-right",
        },
        {
          name: "Bottom Left",
          value: "bottom-left",
        },
        {
          name: "Top Right",
          value: "top-right",
        },
        {
          name: "Top Left",
          value: "top-left",
        },
      ],
      default: "bottom-right",
      description: "Position of the chat bubble on the page",
    },
    {
      displayName: "Bubble Color",
      name: "bubbleColor",
      type: "string",
      default: "#3b82f6",
      description: "Background color of the chat bubble (hex color code)",
      placeholder: "#3b82f6",
    },
    {
      displayName: "Header Color",
      name: "headerColor",
      type: "string",
      default: "#1f2937",
      description: "Background color of the chat header (hex color code)",
      placeholder: "#1f2937",
    },
    {
      displayName: "User Message",
      name: "userMessage",
      type: "string",
      default: "",
      required: true,
      description: "The message entered by the user",
      placeholder: "Enter your message here...",
    },
    {
      displayName: "AI Service",
      name: "aiService",
      type: "options",
      options: [
        {
          name: "None (Pass-through only)",
          value: "none",
        },
        {
          name: "OpenAI",
          value: "openai",
        },
        {
          name: "Anthropic",
          value: "anthropic",
        },
      ],
      default: "none",
      description: "AI service to use for generating responses",
    },
    {
      displayName: "AI Model",
      name: "aiModel",
      type: "string",
      default: "gpt-4o-mini",
      description: "AI model to use (e.g., gpt-4o-mini, claude-3-sonnet-20240229)",
      displayOptions: {
        show: {
          aiService: ["openai", "anthropic"],
        },
      },
    },
    {
      displayName: "System Prompt",
      name: "systemPrompt",
      type: "string",
      default: "You are a helpful AI assistant.",
      description: "System prompt to guide the AI's behavior",
      displayOptions: {
        show: {
          aiService: ["openai", "anthropic"],
        },
      },
    },
    {
      displayName: "Max Tokens",
      name: "maxTokens",
      type: "number",
      default: 1000,
      description: "Maximum number of tokens in the AI response",
      displayOptions: {
        show: {
          aiService: ["openai", "anthropic"],
        },
      },
    },
    {
      displayName: "Temperature",
      name: "temperature",
      type: "number",
      default: 0.7,
      description: "Controls randomness in AI responses (0.0 to 1.0)",
      displayOptions: {
        show: {
          aiService: ["openai", "anthropic"],
        },
      },
    },
  ],

  execute: async function (
    inputData: NodeInputData
  ): Promise<NodeOutputData[]> {
    // Check if node is configured to accept input
    const acceptInput = await this.getNodeParameter("acceptInput", 0) as boolean;

    // Determine items based on input mode
    let items;
    if (acceptInput && inputData.main?.[0]?.length) {
      // Use input from previous nodes
      items = inputData.main[0];
    } else {
      // For trigger mode, create a default item if no input
      items = [{ json: {} }];
    }

    const results = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];

        // Get user message (await the async call)
        const userMessage = await this.getNodeParameter("userMessage", i) as string;
        const aiService = await this.getNodeParameter("aiService", i) as string;

        // Build base output
        const resultData: any = {
          message: userMessage,
          userMessage: userMessage,
          timestamp: new Date().toISOString(),
        };

        // If accepting input, merge with incoming data
        if (acceptInput && item.json) {
          resultData.inputData = item.json;
        }

        // Generate AI response if AI service is configured
        if (aiService && aiService !== "none") {
          try {
            const systemPrompt = await this.getNodeParameter("systemPrompt", i) as string;
            const aiModel = await this.getNodeParameter("aiModel", i) as string;
            const maxTokens = await this.getNodeParameter("maxTokens", i) as number;
            const temperature = await this.getNodeParameter("temperature", i) as number;

            let aiResponse = "";

            if (aiService === "openai") {
              // Get OpenAI credentials
              const credentials = await this.getCredentials("openaiApi");
              if (!credentials || !credentials.apiKey) {
                throw new Error("OpenAI API key is required. Please configure credentials.");
              }

              // Import OpenAI dynamically to avoid issues if not installed
              const OpenAI = require("openai");
              const openai = new OpenAI({
                apiKey: credentials.apiKey as string,
              });

              const response = await openai.chat.completions.create({
                model: aiModel,
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userMessage }
                ],
                max_tokens: maxTokens,
                temperature: temperature,
              });

              aiResponse = response.choices[0]?.message?.content || "No response generated";

            } else if (aiService === "anthropic") {
              // Get Anthropic credentials
              const credentials = await this.getCredentials("anthropicApi");
              if (!credentials || !credentials.apiKey) {
                throw new Error("Anthropic API key is required. Please configure credentials.");
              }

              // Import Anthropic dynamically
              const Anthropic = require("@anthropic-ai/sdk");
              const anthropic = new Anthropic({
                apiKey: credentials.apiKey as string,
              });

              const response = await anthropic.messages.create({
                model: aiModel,
                max_tokens: maxTokens,
                temperature: temperature,
                system: systemPrompt,
                messages: [
                  { role: "user", content: userMessage }
                ],
              });

              aiResponse = response.content[0]?.text || "No response generated";
            } else {
              throw new Error(`Unsupported AI service: ${aiService}`);
            }

            resultData.aiResponse = aiResponse;
            resultData.response = aiResponse; // Also add as 'response' for compatibility

          } catch (aiError: any) {
            this.logger?.warn("AI response generation failed", {
              error: aiError.message,
              service: aiService,
            });
            resultData.aiError = aiError.message;
            resultData.response = "I'm sorry, I encountered an error while processing your message.";
          }
        }

        results.push({
          json: resultData,
        });
      } catch (error: any) {
        this.logger?.error("Chat node execution failed", {
          error: error.message,
          itemIndex: i,
        });

        // Handle errors gracefully
        results.push({
          json: {
            error: true,
            errorMessage: error.message,
            errorDetails: error.toString(),
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    return [{ main: results }];
  },
};
