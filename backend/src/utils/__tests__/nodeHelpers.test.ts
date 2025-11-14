import {
  extractJsonData,
  normalizeInputItems,
  resolvePath,
  resolveValue,
  wrapJsonData,
} from "../nodeHelpers";

describe("Node Helper Functions", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe("resolveValue", () => {
    it("should resolve simple placeholders", () => {
      const item = { name: "John", age: 30 };
      const result = resolveValue("Hello {{json.name}}", item);
      expect(result).toBe("Hello John");
    });

    it("should resolve nested placeholders", () => {
      const item = { user: { profile: { email: "john@example.com" } } };
      const result = resolveValue("Email: {{json.user.profile.email}}", item);
      expect(result).toBe("Email: john@example.com");
    });

    it("should handle multiple placeholders", () => {
      const item = { firstName: "John", lastName: "Doe" };
      const result = resolveValue("{{json.firstName}} {{json.lastName}}", item);
      expect(result).toBe("John Doe");
    });

    it("should return original string if placeholder not found", () => {
      const item = { name: "John" };
      const result = resolveValue("Hello {{json.missing}}", item);
      expect(result).toBe("Hello {{json.missing}}");
    });

    it("should handle non-string values", () => {
      const item = { name: "John" };
      const result = resolveValue(123, item);
      expect(result).toBe(123);
    });

    it("should handle values without placeholders", () => {
      const item = { name: "John" };
      const result = resolveValue("Static text", item);
      expect(result).toBe("Static text");
    });

    it("should handle URL-encoded placeholders", () => {
      const item = { iteration: 1 };
      // URL-encoded version of {{json.iteration}}
      const result = resolveValue("https://jsonplaceholder.typicode.com/todos/%7B%7Bjson.iteration%7D%7D", item);
      expect(result).toBe("https://jsonplaceholder.typicode.com/todos/1");
    });

    it("should handle partially URL-encoded values", () => {
      const item = { id: 42 };
      const result = resolveValue("https://api.example.com/items/%7B%7Bjson.id%7D%7D/details", item);
      expect(result).toBe("https://api.example.com/items/42/details");
    });

    it("should resolve array-based access for multiple inputs", () => {
      const items = [
        { name: "John", age: 30 },
        { name: "Jane", age: 25 }
      ];
      const result = resolveValue("{{json[0].name}} and {{json[1].name}}", items);
      expect(result).toBe("John and Jane");
    });

    it("should resolve nested fields with array-based access", () => {
      const items = [
        { user: { profile: { email: "john@example.com" } } },
        { user: { profile: { email: "jane@example.com" } } }
      ];
      const result = resolveValue("{{json[0].user.profile.email}}", items);
      expect(result).toBe("john@example.com");
    });

    it("should handle out of bounds array access", () => {
      const items = [{ name: "John" }];
      const result = resolveValue("{{json[5].name}}", items);
      expect(result).toBe("{{json[5].name}}");
    });

    it("should handle array access on non-array item", () => {
      const item = { name: "John" };
      const result = resolveValue("{{json[0].name}}", item);
      expect(result).toBe("{{json[0].name}}");
    });
  });

  describe("resolvePath", () => {
    it("should resolve simple paths", () => {
      const obj = { name: "John", age: 30 };
      const result = resolvePath(obj, "name");
      expect(result).toBe("John");
    });

    it("should resolve nested paths", () => {
      const obj = {
        user: {
          profile: {
            email: "john@example.com",
          },
        },
      };
      const result = resolvePath(obj, "user.profile.email");
      expect(result).toBe("john@example.com");
    });

    it("should resolve array paths", () => {
      const obj = { items: [{ id: 1 }, { id: 2 }] };
      const result = resolvePath(obj, "items[0].id");
      expect(result).toBe(1);
    });

    it("should return undefined for invalid paths", () => {
      const obj = { name: "John" };
      const result = resolvePath(obj, "user.profile.email");
      expect(result).toBeUndefined();
    });

    it("should handle null or undefined objects", () => {
      expect(resolvePath(null, "name")).toBeUndefined();
      expect(resolvePath(undefined, "name")).toBeUndefined();
    });
  });

  describe("extractJsonData", () => {
    it("should extract data from wrapped items", () => {
      const wrapped = [
        { json: { id: 1, name: "Item 1" } },
        { json: { id: 2, name: "Item 2" } },
      ];
      const result = extractJsonData(wrapped);
      expect(result).toEqual([
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ]);
    });

    it("should handle already unwrapped items", () => {
      const unwrapped = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ];
      const result = extractJsonData(unwrapped);
      expect(result).toEqual(unwrapped);
    });

    it("should handle empty arrays", () => {
      const result = extractJsonData([]);
      expect(result).toEqual([]);
    });

    it("should handle mixed wrapped and unwrapped items", () => {
      const mixed = [
        { json: { id: 1, name: "Item 1" } },
        { id: 2, name: "Item 2" },
      ];
      const result = extractJsonData(mixed);
      expect(result).toEqual([
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ]);
    });
  });

  describe("wrapJsonData", () => {
    it("should wrap plain items", () => {
      const items = [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ];
      const result = wrapJsonData(items);
      expect(result).toEqual([
        { json: { id: 1, name: "Item 1" } },
        { json: { id: 2, name: "Item 2" } },
      ]);
    });

    it("should handle empty arrays", () => {
      const result = wrapJsonData([]);
      expect(result).toEqual([]);
    });

    it("should wrap any type of data", () => {
      const items = [1, "string", { key: "value" }, null];
      const result = wrapJsonData(items);
      expect(result).toEqual([
        { json: 1 },
        { json: "string" },
        { json: { key: "value" } },
        { json: null },
      ]);
    });
  });

  describe("normalizeInputItems", () => {
    it("should unwrap nested arrays", () => {
      const nested = [[{ json: { id: 1 } }, { json: { id: 2 } }]];
      const result = normalizeInputItems(nested);
      expect(result).toEqual([{ json: { id: 1 } }, { json: { id: 2 } }]);
    });

    it("should return flat arrays as-is", () => {
      const flat = [{ json: { id: 1 } }, { json: { id: 2 } }];
      const result = normalizeInputItems(flat);
      expect(result).toEqual(flat);
    });

    it("should handle empty arrays", () => {
      const result = normalizeInputItems([]);
      expect(result).toEqual([]);
    });

    it("should handle null or undefined", () => {
      expect(normalizeInputItems(null as any)).toEqual([]);
      expect(normalizeInputItems(undefined as any)).toEqual([]);
    });

    it("should not unwrap if first element is not an array", () => {
      const items = [{ json: { id: 1 } }];
      const result = normalizeInputItems(items);
      expect(result).toEqual(items);
    });
  });

  describe("Integration: Full workflow", () => {
    it("should work together to process workflow data", () => {
      // Simulate incoming workflow data
      const inputData = [
        [
          { json: { name: "Alice", age: 30 } },
          { json: { name: "Bob", age: 25 } },
        ],
      ];

      // Step 1: Normalize
      const normalized = normalizeInputItems(inputData);
      expect(normalized).toHaveLength(2);

      // Step 2: Extract
      const extracted = extractJsonData(normalized);
      expect(extracted).toEqual([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ]);

      // Step 3: Process with resolveValue
      const template = "Name: {{json.name}}, Age: {{json.age}}";
      const processed = extracted.map((item) => ({
        result: resolveValue(template, item),
      }));
      expect(processed).toEqual([
        { result: "Name: Alice, Age: 30" },
        { result: "Name: Bob, Age: 25" },
      ]);

      // Step 4: Wrap for output
      const wrapped = wrapJsonData(processed);
      expect(wrapped).toEqual([
        { json: { result: "Name: Alice, Age: 30" } },
        { json: { result: "Name: Bob, Age: 25" } },
      ]);
    });
  });
});
