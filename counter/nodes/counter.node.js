// Global state storage for counter instances

const { config } = require("dotenv");

// In a real implementation, this might be stored in a database or Redis
const globalCounterState = new Map();

const CounterNode = {
  identifier: "counter",
  displayName: "Counter",
  name: "counter",
  group: ["transform"],
  version: 1,
  description:
    "A counter node that maintains state and increments a number when executed",
  icon: "fa:calculator",
  color: "#4CAF50",
  defaults: {
    name: "Counter",
  },
  inputs: ["main"],
  outputs: ["main"],
  properties: [
    {
      displayName: "Operation",
      name: "operation",
      type: "options",
      required: true,
      default: "increment",
      options: [
        {
          name: "Increment",
          value: "increment",
          description: "Increment the counter by the step value",
        },
        {
          name: "Get Current",
          value: "get",
          description: "Get the current counter value without incrementing",
        },
        {
          name: "Reset",
          value: "reset",
          description: "Reset the counter to the initial value",
        },
      ],
    },
    {
      displayName: "Step",
      name: "step",
      type: "number",
      default: 1,
      description: "The amount to increment the counter by",
      displayOptions: {
        show: {
          operation: ["increment"],
        },
      },
    },
    {
      displayName: "Initial Value",
      name: "initialValue",
      type: "number",
      default: 0,
      description: "The starting value for the counter",
    },
    {
      displayName: "Counter ID",
      name: "counterId",
      type: "string",
      default: "default",
      description:
        "Unique identifier for this counter instance (allows multiple independent counters)",
    },
  ],

  execute: async function (inputData) {
    console.log("=== COUNTER NODE EXECUTION START ===");
    console.log("Node type:", this.type || "counter");
    console.log("Input data:", JSON.stringify(inputData, null, 2));

    const operation = this.getNodeParameter("operation");
    const step = this.getNodeParameter("step") || 1;
    const initialValue = this.getNodeParameter("initialValue") || 0;
    const counterId = this.getNodeParameter("counterId") || "default";
    const items = inputData.main?.[0] || [];

    console.log("Selected operation:", operation);
    console.log("Step:", step);
    console.log("Initial value:", initialValue);
    console.log("Counter ID:", counterId);
    console.log("Number of input items:", items.length);

    // Get or initialize counter state
    const stateKey = `${this.name || "counter"}_${counterId}`;
    if (!globalCounterState.has(stateKey)) {
      globalCounterState.set(stateKey, {
        count: initialValue,
        initialValue: initialValue,
        createdAt: new Date().toISOString(),
      });
      console.log("Initialized new counter state for:", stateKey);
    }

    const counterState = globalCounterState.get(stateKey);
    const previousCount = counterState.count;

    console.log("Current counter state:", counterState);

    let resultItems;
    const timestamp = new Date().toISOString();

    switch (operation) {
      case "increment":
        // Increment the counter
        counterState.count += step;
        globalCounterState.set(stateKey, {
          ...counterState,
          lastUpdated: timestamp,
        });

        resultItems = [
          {
            count: counterState.count,
            previousCount: previousCount,
            step: step,
            operation: operation,
            counterId: counterId,
            timestamp: timestamp,
            initialValue: counterState.initialValue,
          },
        ];
        console.log("Increment result:", JSON.stringify(resultItems, null, 2));
        break;

      case "get":
        // Get current value without incrementing
        resultItems = [
          {
            count: counterState.count,
            previousCount: counterState.count, // Same as current since we're not incrementing
            step: 0,
            operation: operation,
            counterId: counterId,
            timestamp: timestamp,
            initialValue: counterState.initialValue,
          },
        ];
        console.log(
          "Get current result:",
          JSON.stringify(resultItems, null, 2)
        );
        break;

      case "reset":
        // Reset counter to initial value
        const oldCount = counterState.count;
        counterState.count = counterState.initialValue;
        globalCounterState.set(stateKey, {
          ...counterState,
          lastUpdated: timestamp,
        });

        resultItems = [
          {
            count: counterState.count,
            previousCount: oldCount,
            step: 0,
            operation: operation,
            counterId: counterId,
            timestamp: timestamp,
            initialValue: counterState.initialValue,
            resetFrom: oldCount,
          },
        ];
        console.log("Reset result:", JSON.stringify(resultItems, null, 2));
        break;

      default:
        const error = `Unknown operation: ${operation}`;
        console.error("ERROR:", error);
        throw new Error(error);
    }

    // Log current state of all counters
    console.log("All counter states:", Object.fromEntries(globalCounterState));

    console.log(
      "Final output structure:",
      JSON.stringify(resultItems, null, 2)
    );
    console.log("=== COUNTER NODE EXECUTION END ===");

    return resultItems;
  },
};

module.exports = CounterNode;
