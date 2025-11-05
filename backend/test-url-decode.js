// Simple test to verify URL decoding works
function resolveValue(value, item) {
  if (typeof value !== "string") {
    return value;
  }

  // Decode URL-encoded values first
  let decodedValue = value;
  try {
    if (value.includes('%')) {
      decodedValue = decodeURIComponent(value);
    }
  } catch (error) {
    decodedValue = value;
  }

  // Replace placeholders like {{json.fieldName}}
  return decodedValue.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.split(".");
    let result = item;

    let startIndex = 0;
    if (parts[0] === "json") {
      startIndex = 1;
    }

    for (let i = startIndex; i < parts.length; i++) {
      const part = parts[i];

      if (result && typeof result === "object" && part in result) {
        result = result[part];
      } else {
        return match;
      }
    }

    return result !== undefined ? String(result) : match;
  });
}

// Test cases
const item = { iteration: 1, id: 42 };

console.log("Test 1: URL-encoded expression");
const test1 = resolveValue("https://jsonplaceholder.typicode.com/todos/%7B%7Bjson.iteration%7D%7D", item);
console.log("Input:  https://jsonplaceholder.typicode.com/todos/%7B%7Bjson.iteration%7D%7D");
console.log("Output:", test1);
console.log("Expected: https://jsonplaceholder.typicode.com/todos/1");
console.log("Pass:", test1 === "https://jsonplaceholder.typicode.com/todos/1");
console.log();

console.log("Test 2: Normal expression");
const test2 = resolveValue("https://jsonplaceholder.typicode.com/todos/{{json.iteration}}", item);
console.log("Input:  https://jsonplaceholder.typicode.com/todos/{{json.iteration}}");
console.log("Output:", test2);
console.log("Expected: https://jsonplaceholder.typicode.com/todos/1");
console.log("Pass:", test2 === "https://jsonplaceholder.typicode.com/todos/1");
console.log();

console.log("Test 3: Partially URL-encoded");
const test3 = resolveValue("https://api.example.com/items/%7B%7Bjson.id%7D%7D/details", item);
console.log("Input:  https://api.example.com/items/%7B%7Bjson.id%7D%7D/details");
console.log("Output:", test3);
console.log("Expected: https://api.example.com/items/42/details");
console.log("Pass:", test3 === "https://api.example.com/items/42/details");
