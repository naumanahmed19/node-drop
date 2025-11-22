import { CustomNodeUploadHandler } from '../../services/CustomNodeUploadHandler';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CustomNodeUploadHandler', () => {
  let handler: CustomNodeUploadHandler;

  beforeEach(() => {
    handler = new CustomNodeUploadHandler();
  });

  describe('extractNodeInfoFromContent', () => {
    it('should extract properties from MySQL node content', async () => {
      // Read the actual MySQL node file
      const mysqlNodePath = path.join(process.cwd(), 'custom-nodes/mysql/nodes/mysql.node.js');
      
      let nodeContent: string;
      try {
        nodeContent = await fs.readFile(mysqlNodePath, 'utf-8');
      } catch (error) {
        // Skip test if file doesn't exist
        console.warn('MySQL node file not found, skipping test');
        return;
      }

      // Access the private method for testing
      const extractMethod = (handler as any).extractNodeInfoFromContent.bind(handler);
      const result = extractMethod(nodeContent, 'mysql.node.js');

      // Verify basic node information
      expect(result.type).toBe('mysql');
      expect(result.displayName).toBe('MySQL');
      expect(result.name).toBe('mysql');
      expect(result.group).toEqual(['database']);
      expect(result.version).toBe(1);
      expect(result.description).toContain('Execute MySQL queries');

      // Verify properties are extracted
      expect(result.properties).toBeDefined();
      expect(Array.isArray(result.properties)).toBe(true);
      expect(result.properties!.length).toBeGreaterThan(0);

      // Verify specific properties
      const authProperty = result.properties!.find(p => p.name === 'authentication');
      expect(authProperty).toBeDefined();
      expect(authProperty!.displayName).toBe('Authentication');
      expect(authProperty!.type).toBe('credential');

      const operationProperty = result.properties!.find(p => p.name === 'operation');
      expect(operationProperty).toBeDefined();
      expect(operationProperty!.displayName).toBe('Operation');
      expect(operationProperty!.type).toBe('options');

      console.log(`✅ Successfully extracted ${result.properties!.length} properties from MySQL node`);
    });

    it('should handle node content without properties gracefully', () => {
      const simpleNodeContent = `
        const SimpleNode = {
          type: "simple",
          displayName: "Simple Node",
          name: "simple",
          group: ["test"],
          version: 1,
          description: "A simple test node",
          inputs: ["main"],
          outputs: ["main"],
          properties: [],
          execute: async function() {
            return [{ main: [] }];
          }
        };
        module.exports = SimpleNode;
      `;

      const extractMethod = (handler as any).extractNodeInfoFromContent.bind(handler);
      const result = extractMethod(simpleNodeContent, 'simple.node.js');

      expect(result.type).toBe('simple');
      expect(result.displayName).toBe('Simple Node');
      expect(result.properties).toEqual([]);
    });

    it('should extract properties from complex node with nested objects', () => {
      const complexNodeContent = `
        const ComplexNode = {
          type: "complex",
          displayName: "Complex Node",
          name: "complex",
          properties: [
            {
              displayName: "Text Field",
              name: "textField",
              type: "string",
              required: true,
              default: "test",
              description: "A text field"
            },
            {
              displayName: "Select Field",
              name: "selectField",
              type: "options",
              options: [
                { name: "Option 1", value: "opt1" },
                { name: "Option 2", value: "opt2" }
              ],
              default: "opt1"
            }
          ]
        };
      `;

      const extractMethod = (handler as any).extractNodeInfoFromContent.bind(handler);
      const result = extractMethod(complexNodeContent, 'complex.node.js');

      expect(result.type).toBe('complex');
      expect(result.properties).toBeDefined();
      expect(result.properties!.length).toBe(2);
      
      const textField = result.properties!.find(p => p.name === 'textField');
      expect(textField).toBeDefined();
      expect(textField!.displayName).toBe('Text Field');
      expect(textField!.type).toBe('string');
      expect(textField!.required).toBe(true);
    });
  });
});
