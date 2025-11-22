import { WebhookTriggerNode, ScheduleTriggerNode, ManualTriggerNode } from '../../nodes/triggers';
import { NodeInputData, NodeExecutionContext } from '../../types/node.types';

// Mock execution context
const createMockContext = (parameters: Record<string, any>): NodeExecutionContext => ({
  getNodeParameter: (parameterName: string) => parameters[parameterName],
  getCredentials: async (type: string) => ({}),
  getInputData: (inputName = 'main') => ({ main: [[]] }),
  helpers: {
    request: jest.fn(),
    requestWithAuthentication: jest.fn(),
    returnJsonArray: (jsonData: any[]) => ({ main: jsonData }),
    normalizeItems: (items: any[]) => items.map(item => ({ json: item }))
  },
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
});

describe('Trigger Nodes', () => {
  describe('WebhookTriggerNode', () => {
    it('should have correct node definition', () => {
      expect(WebhookTriggerNode.type).toBe('webhook-trigger');
      expect(WebhookTriggerNode.displayName).toBe('Webhook Trigger');
      expect(WebhookTriggerNode.group).toEqual(['trigger']);
      expect(WebhookTriggerNode.inputs).toEqual([]);
      expect(WebhookTriggerNode.outputs).toEqual(['main']);
    });

    it('should have required properties', () => {
      const properties = WebhookTriggerNode.properties;
      
      const httpMethodProp = properties.find(p => p.name === 'httpMethod');
      expect(httpMethodProp).toBeDefined();
      expect(httpMethodProp?.type).toBe('options');
      expect(httpMethodProp?.required).toBe(true);

      const authProp = properties.find(p => p.name === 'authentication');
      expect(authProp).toBeDefined();
      expect(authProp?.type).toBe('options');
    });

    it('should execute and return webhook data', async () => {
      const context = createMockContext({
        httpMethod: 'POST',
        authentication: 'none'
      });

      const inputData: NodeInputData = {
        main: [[{
          headers: { 'content-type': 'application/json' },
          query: { param: 'value' },
          body: { test: 'data' },
          method: 'POST'
        }]]
      };

      const result = await WebhookTriggerNode.execute.call(context, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(1);
      expect(result[0].main![0].json).toMatchObject({
        headers: { 'content-type': 'application/json' },
        params: { param: 'value' },
        body: { test: 'data' },
        method: 'POST',
        timestamp: expect.any(String)
      });
    });

    it('should handle empty input data', async () => {
      const context = createMockContext({
        httpMethod: 'GET',
        authentication: 'none'
      });

      const inputData: NodeInputData = { main: [[]] };

      const result = await WebhookTriggerNode.execute.call(context, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(1);
      expect(result[0].main![0].json).toMatchObject({
        headers: {},
        params: {},
        body: {},
        method: 'POST',
        timestamp: expect.any(String)
      });
    });

    it('should have conditional properties for authentication', () => {
      const properties = WebhookTriggerNode.properties;
      
      const headerNameProp = properties.find(p => p.name === 'headerName');
      expect(headerNameProp?.displayOptions?.show?.authentication).toEqual(['header']);

      const expectedValueProp = properties.find(p => p.name === 'expectedValue');
      expect(expectedValueProp?.displayOptions?.show?.authentication).toEqual(['header', 'query']);

      const queryParamProp = properties.find(p => p.name === 'queryParam');
      expect(queryParamProp?.displayOptions?.show?.authentication).toEqual(['query']);

      const usernameProp = properties.find(p => p.name === 'username');
      expect(usernameProp?.displayOptions?.show?.authentication).toEqual(['basic']);

      const passwordProp = properties.find(p => p.name === 'password');
      expect(passwordProp?.displayOptions?.show?.authentication).toEqual(['basic']);
    });
  });

  describe('ScheduleTriggerNode', () => {
    it('should have correct node definition', () => {
      expect(ScheduleTriggerNode.type).toBe('schedule-trigger');
      expect(ScheduleTriggerNode.displayName).toBe('Schedule Trigger');
      expect(ScheduleTriggerNode.group).toEqual(['trigger']);
      expect(ScheduleTriggerNode.inputs).toEqual([]);
      expect(ScheduleTriggerNode.outputs).toEqual(['main']);
    });

    it('should have required properties', () => {
      const properties = ScheduleTriggerNode.properties;
      
      const cronProp = properties.find(p => p.name === 'cronExpression');
      expect(cronProp).toBeDefined();
      expect(cronProp?.type).toBe('string');
      expect(cronProp?.required).toBe(true);
      expect(cronProp?.default).toBe('0 0 * * *');

      const timezoneProp = properties.find(p => p.name === 'timezone');
      expect(timezoneProp).toBeDefined();
      expect(timezoneProp?.type).toBe('options');
      expect(timezoneProp?.default).toBe('UTC');
    });

    it('should execute and return schedule data', async () => {
      const context = createMockContext({
        cronExpression: '0 0 * * *',
        timezone: 'UTC',
        description: 'Daily at midnight'
      });

      const inputData: NodeInputData = { main: [[]] };

      const result = await ScheduleTriggerNode.execute.call(context, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(1);
      expect(result[0].main![0].json).toMatchObject({
        scheduledAt: expect.any(String),
        cronExpression: '0 0 * * *',
        timezone: 'UTC',
        description: 'Daily at midnight',
        triggerType: 'schedule'
      });
    });

    it('should have timezone options', () => {
      const properties = ScheduleTriggerNode.properties;
      const timezoneProp = properties.find(p => p.name === 'timezone');
      
      expect(timezoneProp?.options).toContainEqual({ name: 'UTC', value: 'UTC' });
      expect(timezoneProp?.options).toContainEqual({ name: 'America/New_York', value: 'America/New_York' });
      expect(timezoneProp?.options).toContainEqual({ name: 'Europe/London', value: 'Europe/London' });
      expect(timezoneProp?.options).toContainEqual({ name: 'Asia/Tokyo', value: 'Asia/Tokyo' });
    });
  });

  describe('ManualTriggerNode', () => {
    it('should have correct node definition', () => {
      expect(ManualTriggerNode.type).toBe('manual-trigger');
      expect(ManualTriggerNode.displayName).toBe('Manual Trigger');
      expect(ManualTriggerNode.group).toEqual(['trigger']);
      expect(ManualTriggerNode.inputs).toEqual([]);
      expect(ManualTriggerNode.outputs).toEqual(['main']);
    });

    it('should have required properties', () => {
      const properties = ManualTriggerNode.properties;
      
      const descriptionProp = properties.find(p => p.name === 'description');
      expect(descriptionProp).toBeDefined();
      expect(descriptionProp?.type).toBe('string');
      expect(descriptionProp?.required).toBe(false);

      const allowCustomDataProp = properties.find(p => p.name === 'allowCustomData');
      expect(allowCustomDataProp).toBeDefined();
      expect(allowCustomDataProp?.type).toBe('boolean');
      expect(allowCustomDataProp?.default).toBe(false);
    });

    it('should execute and return basic trigger data', async () => {
      const context = createMockContext({
        description: 'Test manual trigger',
        allowCustomData: false
      });

      const inputData: NodeInputData = { main: [[]] };

      const result = await ManualTriggerNode.execute.call(context, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(1);
      expect(result[0].main![0].json).toMatchObject({
        triggeredAt: expect.any(String),
        triggerType: 'manual',
        description: 'Test manual trigger',
        customData: undefined
      });
    });

    it('should handle custom data when allowed', async () => {
      const context = createMockContext({
        description: 'Test manual trigger',
        allowCustomData: true,
        defaultData: '{"default": "value"}'
      });

      const inputData: NodeInputData = {
        main: [[{
          json: { custom: 'data', value: 123 }
        }]]
      };

      const result = await ManualTriggerNode.execute.call(context, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(1);
      expect(result[0].main![0].json).toMatchObject({
        triggeredAt: expect.any(String),
        triggerType: 'manual',
        description: 'Test manual trigger',
        customData: { custom: 'data', value: 123 }
      });
    });

    it('should use default data when no custom data provided', async () => {
      const context = createMockContext({
        description: 'Test manual trigger',
        allowCustomData: true,
        defaultData: '{"default": "value"}'
      });

      const inputData: NodeInputData = { main: [[]] };

      const result = await ManualTriggerNode.execute.call(context, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(1);
      expect(result[0].main![0].json).toMatchObject({
        triggeredAt: expect.any(String),
        triggerType: 'manual',
        description: 'Test manual trigger',
        customData: { default: 'value' }
      });
    });

    it('should handle invalid JSON in default data', async () => {
      const context = createMockContext({
        description: 'Test manual trigger',
        allowCustomData: true,
        defaultData: 'invalid-json'
      });

      const inputData: NodeInputData = { main: [[]] };

      const result = await ManualTriggerNode.execute.call(context, inputData);

      expect(result).toHaveLength(1);
      expect(result[0].main).toHaveLength(1);
      expect(result[0].main![0].json).toMatchObject({
        triggeredAt: expect.any(String),
        triggerType: 'manual',
        description: 'Test manual trigger',
        customData: {}
      });
    });

    it('should have conditional properties for custom data', () => {
      const properties = ManualTriggerNode.properties;
      
      const defaultDataProp = properties.find(p => p.name === 'defaultData');
      expect(defaultDataProp?.displayOptions?.show?.allowCustomData).toEqual([true]);
    });
  });

  describe('Node Validation', () => {
    it('should validate webhook trigger properties', () => {
      const properties = WebhookTriggerNode.properties;
      
      // Check that all required properties are present
      const requiredProps = ['httpMethod', 'authentication'];
      requiredProps.forEach(propName => {
        const prop = properties.find(p => p.name === propName);
        expect(prop).toBeDefined();
        expect(prop?.required).toBe(true);
      });

      // Check HTTP method options
      const httpMethodProp = properties.find(p => p.name === 'httpMethod');
      const expectedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      expectedMethods.forEach(method => {
        expect(httpMethodProp?.options).toContainEqual({ name: method, value: method });
      });
    });

    it('should validate schedule trigger properties', () => {
      const properties = ScheduleTriggerNode.properties;
      
      const cronProp = properties.find(p => p.name === 'cronExpression');
      expect(cronProp?.required).toBe(true);
      expect(cronProp?.type).toBe('string');

      const timezoneProp = properties.find(p => p.name === 'timezone');
      expect(timezoneProp?.required).toBe(true);
      expect(timezoneProp?.type).toBe('options');
    });

    it('should validate manual trigger properties', () => {
      const properties = ManualTriggerNode.properties;
      
      const descriptionProp = properties.find(p => p.name === 'description');
      expect(descriptionProp?.required).toBe(false);
      expect(descriptionProp?.type).toBe('string');

      const allowCustomDataProp = properties.find(p => p.name === 'allowCustomData');
      expect(allowCustomDataProp?.required).toBe(false);
      expect(allowCustomDataProp?.type).toBe('boolean');
    });
  });

  describe('Node Defaults', () => {
    it('should have correct webhook trigger defaults', () => {
      expect(WebhookTriggerNode.defaults).toMatchObject({
        httpMethod: 'POST',
        path: '',
        authentication: { type: 'none' },
        responseMode: 'onReceived',
        responseData: 'firstEntryJson'
      });
    });

    it('should have correct schedule trigger defaults', () => {
      expect(ScheduleTriggerNode.defaults).toMatchObject({
        cronExpression: '0 0 * * *',
        timezone: 'UTC'
      });
    });

    it('should have correct manual trigger defaults', () => {
      expect(ManualTriggerNode.defaults).toMatchObject({
        description: '',
        allowCustomData: false
      });
    });
  });
});
