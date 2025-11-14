// Auto-export all nodes using discovery
export * from "../utils/NodeDiscovery";

// Export individual nodes from new structure
export * from "./Code";
export * from "./CustomTemplate";
export * from "./DynamicProperties";
export * from "./GoogleSheetsTrigger/GoogleSheetsTrigger.node";
export * from "./HttpRequest";
// export * from "./PostgreSQL/PostgreSQL.node"; // PostgreSQL node not yet implemented
// export * from "./If";
export * from "./Json";
export * from "./Loop";
export * from "./Merge";
export * from "./Split";
export * from "./ManualTrigger";
export * from "./ScheduleTrigger";
export * from "./Set";
export * from "./Switch";
export * from "./IfElse";
export * from "./WebhookTrigger";
export * from "./WorkflowCalled";
export * from "./WorkflowTrigger";

// AI Nodes
export * from "./Anthropic";
export * from "./OpenAI";

// Preview Nodes
export * from "./ImagePreview";
export * from "./DataPreview";
