import { LoopNode } from "../Loop.node";
import { NodeInputData } from "../../../types/node.types";

describe("LoopNode", () => {
  describe("Node Definition", () => {
    it("should have correct basic properties", () => {
      expect(LoopNode.type).toBe("loop");
      expect(LoopNode.displayName).toBe("Loop");
      expect(LoopNode.name).toBe("loop");
      expect(LoopNode.version).toBe(1);
      expect(LoopNode.group).toContain("transform");
    });

    it("should have required properties", () => {
      expect(Array.isArray(LoopNode.properties)).toBe(true);
      expect(LoopNode.properties.length).toBeGreaterThan(0);
    });

    it("should have loopOver property with correct options", () => {
      const loopOverProp = LoopNode.properties.find((p) => p.name === "loopOver");
      expect(loopOverProp).toBeDefined();
      expect(loopOverProp?.type).toBe("options");
      expect(loopOverProp?.options).toHaveLength(3);
      expect(loopOverProp?.options?.[0].value).toBe("items");
      expect(loopOverProp?.options?.[1].value).toBe("field");
      expect(loopOverProp?.options?.[2].value).toBe("repeat");
    });

    it("should have mode property with correct options", () => {
      const modeProp = LoopNode.properties.find((p) => p.name === "mode");
      expect(modeProp).toBeDefined();
      expect(modeProp?.type).toBe("options");
      expect(modeProp?.options).toHaveLength(2);
      expect(modeProp?.options?.[0].value).toBe("each");
      expect(modeProp?.options?.[1].value).toBe("batch");
    });

    it("should have fieldName property", () => {
      const fieldNameProp = LoopNode.properties.find((p) => p.name === "fieldName");
      expect(fieldNameProp).toBeDefined();
      expect(fieldNameProp?.type).toBe("string");
    });

    it("should have batchSize property", () => {
      const batchSizeProp = LoopNode.properties.find((p) => p.name === "batchSize");
      expect(batchSizeProp).toBeDefined();
      expect(batchSizeProp?.type).toBe("number");
    });
  });

  describe("Execute Function - Loop Over Items", () => {
    const createMockContext = (parameters: Record<string, any>) => ({
      getNodeParameter: jest.fn(async (paramName: string) => parameters[paramName]),
      getCredentials: jest.fn(),
      getInputData: jest.fn(),
      helpers: {} as any,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      resolveValue: jest.fn(),
      resolvePath: jest.fn((obj: any, path: string) => {
        const keys = path.split(".");
        return keys.reduce((current, key) => current?.[key], obj);
      }),
      extractJsonData: jest.fn(),
      wrapJsonData: jest.fn(),
      normalizeInputItems: jest.fn(),
    });

    it("should iterate over all input items in each mode", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [
          [
            { json: { id: 1, name: "John" } },
            { json: { id: 2, name: "Jane" } },
            { json: { id: 3, name: "Bob" } },
          ],
        ],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(3);
      expect(result[0].main?.[0].json.id).toBe(1);
      expect(result[0].main?.[1].json.id).toBe(2);
      expect(result[0].main?.[2].json.id).toBe(3);
    });

    it("should handle single item", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[{ json: { id: 1, name: "John" } }]],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(1);
      expect(result[0].main?.[0].json.id).toBe(1);
    });

    it("should handle empty input", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[]],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(0);
    });

    it("should handle items without json wrapper", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[{ id: 1, name: "John" }, { id: 2, name: "Jane" }]],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(2);
      expect(result[0].main?.[0].json.id).toBe(1);
      expect(result[0].main?.[1].json.id).toBe(2);
    });
  });

  describe("Execute Function - Loop Over Field", () => {
    const createMockContext = (parameters: Record<string, any>) => ({
      getNodeParameter: jest.fn(async (paramName: string) => parameters[paramName]),
      getCredentials: jest.fn(),
      getInputData: jest.fn(),
      helpers: {} as any,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      resolveValue: jest.fn(),
      resolvePath: jest.fn((obj: any, path: string) => {
        const keys = path.split(".");
        return keys.reduce((current, key) => current?.[key], obj);
      }),
      extractJsonData: jest.fn(),
      wrapJsonData: jest.fn(),
      normalizeInputItems: jest.fn(),
    });

    it("should loop over array in a field", async () => {
      const mockContext = createMockContext({
        loopOver: "field",
        fieldName: "users",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [
          [
            {
              json: {
                users: [
                  { name: "John", email: "john@example.com" },
                  { name: "Jane", email: "jane@example.com" },
                ],
              },
            },
          ],
        ],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(2);
      expect(result[0].main?.[0].json.name).toBe("John");
      expect(result[0].main?.[1].json.name).toBe("Jane");
    });

    it("should loop over nested field", async () => {
      const mockContext = createMockContext({
        loopOver: "field",
        fieldName: "data.items",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [
          [
            {
              json: {
                data: {
                  items: [{ id: 1 }, { id: 2 }, { id: 3 }],
                },
              },
            },
          ],
        ],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(3);
      expect(result[0].main?.[0].json.id).toBe(1);
      expect(result[0].main?.[1].json.id).toBe(2);
      expect(result[0].main?.[2].json.id).toBe(3);
    });

    it("should throw error if field name is empty", async () => {
      const mockContext = createMockContext({
        loopOver: "field",
        fieldName: "",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[{ json: { users: [] } }]],
      };

      await expect(LoopNode.execute.call(mockContext, inputData)).rejects.toThrow(
        "Field name is required"
      );
    });

    it("should throw error if no input items", async () => {
      const mockContext = createMockContext({
        loopOver: "field",
        fieldName: "users",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[]],
      };

      await expect(LoopNode.execute.call(mockContext, inputData)).rejects.toThrow(
        "No input items to extract field from"
      );
    });

    it("should throw error if field is not an array", async () => {
      const mockContext = createMockContext({
        loopOver: "field",
        fieldName: "user",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[{ json: { user: { name: "John" } } }]],
      };

      await expect(LoopNode.execute.call(mockContext, inputData)).rejects.toThrow(
        "is not an array"
      );
    });
  });

  describe("Execute Function - Batch Mode", () => {
    const createMockContext = (parameters: Record<string, any>) => ({
      getNodeParameter: jest.fn(async (paramName: string) => parameters[paramName]),
      getCredentials: jest.fn(),
      getInputData: jest.fn(),
      helpers: {} as any,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      resolveValue: jest.fn(),
      resolvePath: jest.fn((obj: any, path: string) => {
        const keys = path.split(".");
        return keys.reduce((current, key) => current?.[key], obj);
      }),
      extractJsonData: jest.fn(),
      wrapJsonData: jest.fn(),
      normalizeInputItems: jest.fn(),
    });

    it("should process items in batches", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "batch",
        batchSize: 2,
      });

      const inputData: NodeInputData = {
        main: [
          [
            { json: { id: 1 } },
            { json: { id: 2 } },
            { json: { id: 3 } },
            { json: { id: 4 } },
            { json: { id: 5 } },
          ],
        ],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(3); // 3 batches
      expect(result[0].main?.[0].json.items).toHaveLength(2);
      expect(result[0].main?.[0].json.count).toBe(2);
      expect(result[0].main?.[1].json.items).toHaveLength(2);
      expect(result[0].main?.[1].json.count).toBe(2);
      expect(result[0].main?.[2].json.items).toHaveLength(1);
      expect(result[0].main?.[2].json.count).toBe(1);
    });

    it("should handle batch size equal to item count", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "batch",
        batchSize: 3,
      });

      const inputData: NodeInputData = {
        main: [
          [
            { json: { id: 1 } },
            { json: { id: 2 } },
            { json: { id: 3 } },
          ],
        ],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(1);
      expect(result[0].main?.[0].json.items).toHaveLength(3);
      expect(result[0].main?.[0].json.count).toBe(3);
    });

    it("should handle batch size larger than item count", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "batch",
        batchSize: 10,
      });

      const inputData: NodeInputData = {
        main: [
          [
            { json: { id: 1 } },
            { json: { id: 2 } },
          ],
        ],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(1);
      expect(result[0].main?.[0].json.items).toHaveLength(2);
      expect(result[0].main?.[0].json.count).toBe(2);
    });

    it("should throw error if batch size is zero", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "batch",
        batchSize: 0,
      });

      const inputData: NodeInputData = {
        main: [[{ json: { id: 1 } }]],
      };

      await expect(LoopNode.execute.call(mockContext, inputData)).rejects.toThrow(
        "Batch size must be greater than 0"
      );
    });

    it("should throw error if batch size is negative", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "batch",
        batchSize: -5,
      });

      const inputData: NodeInputData = {
        main: [[{ json: { id: 1 } }]],
      };

      await expect(LoopNode.execute.call(mockContext, inputData)).rejects.toThrow(
        "Batch size must be greater than 0"
      );
    });

    it("should batch items from field", async () => {
      const mockContext = createMockContext({
        loopOver: "field",
        fieldName: "items",
        mode: "batch",
        batchSize: 2,
      });

      const inputData: NodeInputData = {
        main: [
          [
            {
              json: {
                items: [{ id: 1 }, { id: 2 }, { id: 3 }],
              },
            },
          ],
        ],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(2); // 2 batches
      expect(result[0].main?.[0].json.items).toHaveLength(2);
      expect(result[0].main?.[1].json.items).toHaveLength(1);
    });
  });

  describe("Execute Function - Repeat Mode", () => {
    const createMockContext = (parameters: Record<string, any>) => ({
      getNodeParameter: jest.fn(async (paramName: string) => parameters[paramName]),
      getCredentials: jest.fn(),
      getInputData: jest.fn(),
      helpers: {} as any,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      resolveValue: jest.fn(),
      resolvePath: jest.fn((obj: any, path: string) => {
        const keys = path.split(".");
        return keys.reduce((current, key) => current?.[key], obj);
      }),
      extractJsonData: jest.fn(),
      wrapJsonData: jest.fn(),
      normalizeInputItems: jest.fn(),
    });

    it("should repeat N times", async () => {
      const mockContext = createMockContext({
        loopOver: "repeat",
        repeatTimes: 10,
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[]],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(10);
      expect(result[0].main?.[0].json.iteration).toBe(1);
      expect(result[0].main?.[0].json.index).toBe(0);
      expect(result[0].main?.[0].json.total).toBe(10);
      expect(result[0].main?.[9].json.iteration).toBe(10);
      expect(result[0].main?.[9].json.index).toBe(9);
    });

    it("should repeat 100 times", async () => {
      const mockContext = createMockContext({
        loopOver: "repeat",
        repeatTimes: 100,
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[]],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(100);
      expect(result[0].main?.[0].json.iteration).toBe(1);
      expect(result[0].main?.[99].json.iteration).toBe(100);
    });

    it("should repeat with batch mode", async () => {
      const mockContext = createMockContext({
        loopOver: "repeat",
        repeatTimes: 50,
        mode: "batch",
        batchSize: 10,
      });

      const inputData: NodeInputData = {
        main: [[]],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(5); // 5 batches
      expect(result[0].main?.[0].json.items).toHaveLength(10);
      expect(result[0].main?.[0].json.count).toBe(10);
    });

    it("should throw error if repeat times is zero", async () => {
      const mockContext = createMockContext({
        loopOver: "repeat",
        repeatTimes: 0,
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[]],
      };

      await expect(LoopNode.execute.call(mockContext, inputData)).rejects.toThrow(
        "Number of iterations must be greater than 0"
      );
    });

    it("should throw error if repeat times is negative", async () => {
      const mockContext = createMockContext({
        loopOver: "repeat",
        repeatTimes: -5,
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[]],
      };

      await expect(LoopNode.execute.call(mockContext, inputData)).rejects.toThrow(
        "Number of iterations must be greater than 0"
      );
    });

    it("should throw error if repeat times exceeds limit", async () => {
      const mockContext = createMockContext({
        loopOver: "repeat",
        repeatTimes: 200000,
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[]],
      };

      await expect(LoopNode.execute.call(mockContext, inputData)).rejects.toThrow(
        "Number of iterations cannot exceed 100,000"
      );
    });

    it("should work with repeat mode and no input data", async () => {
      const mockContext = createMockContext({
        loopOver: "repeat",
        repeatTimes: 5,
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[]],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(5);
      expect(result[0].main?.[0].json).toEqual({
        iteration: 1,
        index: 0,
        total: 5,
      });
    });
  });

  describe("Edge Cases", () => {
    const createMockContext = (parameters: Record<string, any>) => ({
      getNodeParameter: jest.fn(async (paramName: string) => parameters[paramName]),
      getCredentials: jest.fn(),
      getInputData: jest.fn(),
      helpers: {} as any,
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      resolveValue: jest.fn(),
      resolvePath: jest.fn((obj: any, path: string) => {
        const keys = path.split(".");
        return keys.reduce((current, key) => current?.[key], obj);
      }),
      extractJsonData: jest.fn(),
      wrapJsonData: jest.fn(),
      normalizeInputItems: jest.fn(),
    });

    it("should handle complex nested objects", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [
          [
            {
              json: {
                user: { name: "John", address: { city: "NYC" } },
                items: [1, 2, 3],
              },
            },
          ],
        ],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(1);
      expect(result[0].main?.[0].json.user.address.city).toBe("NYC");
    });

    it("should handle items with null values", async () => {
      const mockContext = createMockContext({
        loopOver: "items",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [
          [
            { json: { id: 1, value: null } },
            { json: { id: 2, value: "test" } },
          ],
        ],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(2);
      expect(result[0].main?.[0].json.value).toBeNull();
      expect(result[0].main?.[1].json.value).toBe("test");
    });

    it("should handle empty array in field", async () => {
      const mockContext = createMockContext({
        loopOver: "field",
        fieldName: "items",
        mode: "each",
      });

      const inputData: NodeInputData = {
        main: [[{ json: { items: [] } }]],
      };

      const result = await LoopNode.execute.call(mockContext, inputData);

      expect(result[0].main).toHaveLength(0);
    });
  });
});
