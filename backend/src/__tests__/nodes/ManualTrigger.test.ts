import { ManualTriggerNode } from '../../nodes/triggers/ManualTrigger';
import { NodeInputData, NodeExecutionContext } from '../../types/node.types';

describe('ManualTriggerNode', () => {
  let mockContext: NodeExecutionContext;

  beforeEach(() => {
    mockContext = {
      getNodeParameter: jest.fn(),
      getCredentials: jest.fn(),
      getInputData: jest.fn(),
      helpers: {
        request: jest.fn(),
        requestWithAuthentication: jest.fn(),
        returnJsonArray: jest.fn(),
        normalizeItems: jest.fn()
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };
  });

  describe('execute', () => {
    it('should execute with default parameters', async () => {
      // Mock parameters
      (mockContext.getNodeParameter as jest.Mock)
        .mockReturnValueOnce('Test trigger') // description
        .mockReturnValueOnce(false) // allowCustomData
        .mockReturnValueOnce('{}') // defaultData
        .mockReturnValueOnce(true) // validateData
        .mockReturnValueOnce(1048576); // maxDataSize

      const inputData: NodeInputData = { main: [[]] };

      const result = await ManualTriggerNode.execute.call(mockContext, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(1);
      expect(result[0].main![0].json).toMatchObject({
        triggerType: 'manual',
        description: 'Test trigger',
        metadata: {
          source: 'manual'
        }
      });
      expect(result[0].main![0].json.triggeredAt).toBeDefined();
      expect(result[0].main![0].json.customData).toBeUndefined();
    });

    it('should execute with custom data when allowed', async () => {
      // Mock parameters
      (mockContext.getNodeParameter as jest.Mock)
        .mockReturnValueOnce('Test trigger with data') // description
        .mockReturnValueOnce(true) // allowCustomData
        .mockReturnValueOnce('{"default": "value"}') // defaultData
        .mockReturnValueOnce(true) // validateData
        .mockReturnValueOnce(1048576); // maxDataSize

      const customData = { user: 'test', action: 'trigger' };
      const inputData: NodeInputData = { 
        main: [[customData]]
      };

      const result = await ManualTriggerNode.execute.call(mockContext, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(1);
      expect(result[0].main![0].json).toMatchObject({
        triggerType: 'manual',
        description: 'Test trigger with data',
        customData: customData,
        metadata: {
          source: 'manual'
        }
      });
    });

    it('should use default data when no custom data provided', async () => {
      // Mock parameters
      (mockContext.getNodeParameter as jest.Mock)
        .mockReturnValueOnce('Test trigger') // description
        .mockReturnValueOnce(true) // allowCustomData
        .mockReturnValueOnce('{"default": "test"}') // defaultData
        .mockReturnValueOnce(true) // validateData
        .mockReturnValueOnce(1048576); // maxDataSize

      const inputData: NodeInputData = { main: [[]] };

      const result = await ManualTriggerNode.execute.call(mockContext, inputData);

      expect(result[0].main![0].json.customData).toEqual({ default: 'test' });
    });

    it('should validate trigger data when validation is enabled', async () => {
      // Mock parameters
      (mockContext.getNodeParameter as jest.Mock)
        .mockReturnValueOnce('Test trigger') // description
        .mockReturnValueOnce(true) // allowCustomData
        .mockReturnValueOnce('{}') // defaultData
        .mockReturnValueOnce(true) // validateData
        .mockReturnValueOnce(100); // maxDataSize (small limit)

      // Large data that exceeds limit
      const largeData = { data: 'x'.repeat(200) };
      const inputData: NodeInputData = { 
        main: [[largeData]]
      };

      await expect(
        ManualTriggerNode.execute.call(mockContext, inputData)
      ).rejects.toThrow(/Data size.*exceeds maximum/);
    });

    it('should handle invalid JSON in default data gracefully', async () => {
      // Mock parameters
      (mockContext.getNodeParameter as jest.Mock)
        .mockReturnValueOnce('Test trigger') // description
        .mockReturnValueOnce(true) // allowCustomData
        .mockReturnValueOnce('invalid json') // defaultData
        .mockReturnValueOnce(false) // validateData
        .mockReturnValueOnce(1048576); // maxDataSize

      const inputData: NodeInputData = { main: [[]] };

      const result = await ManualTriggerNode.execute.call(mockContext, inputData);

      // Should fall back to empty object
      expect(result[0].main![0].json.customData).toEqual({});
    });

    it('should skip validation when disabled', async () => {
      // Mock parameters
      (mockContext.getNodeParameter as jest.Mock)
        .mockReturnValueOnce('Test trigger') // description
        .mockReturnValueOnce(true) // allowCustomData
        .mockReturnValueOnce('{}') // defaultData
        .mockReturnValueOnce(false) // validateData
        .mockReturnValueOnce(100); // maxDataSize

      // Large data that would normally fail validation
      const largeData = { data: 'x'.repeat(200) };
      const inputData: NodeInputData = { 
        main: [[largeData]]
      };

      const result = await ManualTriggerNode.execute.call(mockContext, inputData);

      // Should succeed because validation is disabled
      expect(result[0].main![0].json.customData).toEqual(largeData);
    });
  });

  describe('node definition', () => {
    it('should have correct node definition structure', () => {
      expect(ManualTriggerNode.type).toBe('manual-trigger');
      expect(ManualTriggerNode.displayName).toBe('Manual Trigger');
      expect(ManualTriggerNode.group).toEqual(['trigger']);
      expect(ManualTriggerNode.inputs).toEqual([]);
      expect(ManualTriggerNode.outputs).toEqual(['main']);
      expect(ManualTriggerNode.properties).toHaveLength(5);
      expect(typeof ManualTriggerNode.execute).toBe('function');
    });

    it('should have correct property definitions', () => {
      const properties = ManualTriggerNode.properties;
      
      const descriptionProp = properties.find(p => p.name === 'description');
      expect(descriptionProp).toBeDefined();
      expect(descriptionProp!.type).toBe('string');
      
      const allowCustomDataProp = properties.find(p => p.name === 'allowCustomData');
      expect(allowCustomDataProp).toBeDefined();
      expect(allowCustomDataProp!.type).toBe('boolean');
      
      const defaultDataProp = properties.find(p => p.name === 'defaultData');
      expect(defaultDataProp).toBeDefined();
      expect(defaultDataProp!.type).toBe('json');
      
      const validateDataProp = properties.find(p => p.name === 'validateData');
      expect(validateDataProp).toBeDefined();
      expect(validateDataProp!.type).toBe('boolean');
      
      const maxDataSizeProp = properties.find(p => p.name === 'maxDataSize');
      expect(maxDataSizeProp).toBeDefined();
      expect(maxDataSizeProp!.type).toBe('number');
    });
  });
});
