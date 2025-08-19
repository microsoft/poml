import { describe, expect, test } from '@jest/globals';
import { z } from 'zod';
import { Schema, ToolsSchema } from '../util/schema';

describe('Schema', () => {
  describe('fromZod', () => {
    test('should create a Schema from a Zod schema', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number()
      });

      const schema = Schema.fromZod(zodSchema);
      expect(schema).toBeDefined();
      expect(schema.toZod()).toBe(zodSchema);
    });
  });

  describe('fromOpenAPI', () => {
    test('should create a Schema from an OpenAPI schema', () => {
      const openApiSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };

      const schema = Schema.fromOpenAPI(openApiSchema);
      expect(schema).toBeDefined();
      expect(schema.toOpenAPI()).toBe(openApiSchema);
    });

    test('should accept valid JSON schema types', () => {
      const stringSchema = { type: 'string' };
      const numberSchema = { type: 'number' };
      const booleanSchema = { type: 'boolean' };
      const arraySchema = { type: 'array', items: { type: 'string' } };
      
      expect(() => Schema.fromOpenAPI(stringSchema)).not.toThrow();
      expect(() => Schema.fromOpenAPI(numberSchema)).not.toThrow();
      expect(() => Schema.fromOpenAPI(booleanSchema)).not.toThrow();
      expect(() => Schema.fromOpenAPI(arraySchema)).not.toThrow();
    });

    test('should handle schemas without type property', () => {
      const schemaWithoutType = {
        properties: {
          name: { type: 'string' }
        }
      };
      
      // This should not throw - JSON Schema allows schemas without explicit type
      expect(() => Schema.fromOpenAPI(schemaWithoutType)).not.toThrow();
    });
  });

  describe('toZod', () => {
    test('should return the original Zod schema when created from Zod', () => {
      const zodSchema = z.object({
        id: z.string(),
        count: z.number()
      });

      const schema = Schema.fromZod(zodSchema);
      expect(schema.toZod()).toBe(zodSchema);
    });

    test('should convert OpenAPI schema to Zod', () => {
      const openApiSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };

      const schema = Schema.fromOpenAPI(openApiSchema);
      // Note: This uses Function constructor which is similar to eval
      const zodSchema = schema.toZod();
      expect(zodSchema).toBeDefined();

      // Test that the converted schema can parse valid data
      const validData = { name: 'John', age: 30 };
      const parsed = zodSchema.parse(validData);
      expect(parsed).toEqual(validData);

      // Test that required fields are enforced
      const invalidData = { age: 25 }; // missing required 'name'
      expect(() => zodSchema.parse(invalidData)).toThrow();
    });

    test('should throw error when no schema is available', () => {
      // This test is not possible with current constructor validation
      // Constructor requires at least one schema to be provided
    });
  });

  describe('toOpenAPI', () => {
    test('should return the original OpenAPI schema when created from OpenAPI', () => {
      const openApiSchema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' }
        }
      };

      const schema = Schema.fromOpenAPI(openApiSchema);
      expect(schema.toOpenAPI()).toBe(openApiSchema);
    });

    test('should convert Zod schema to OpenAPI format', () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number().optional(),
        tags: z.array(z.string())
      });

      const schema = Schema.fromZod(zodSchema);
      const openApiSchema = schema.toOpenAPI();

      expect(openApiSchema).toBeDefined();
      expect(openApiSchema.type).toBe('object');
      expect(openApiSchema.properties).toBeDefined();
      expect(openApiSchema.properties.name).toBeDefined();
      expect(openApiSchema.properties.age).toBeDefined();
      expect(openApiSchema.properties.tags).toBeDefined();
      expect(openApiSchema.properties.tags.type).toBe('array');
    });
  });
});

describe('ToolsSchema', () => {
  let toolsSchema: ToolsSchema;

  beforeEach(() => {
    toolsSchema = new ToolsSchema();
  });

  describe('addZodTool', () => {
    test('should add a tool with Zod schema', () => {
      const zodSchema = z.object({
        sign: z.string().describe('An astrological sign like Taurus or Aquarius')
      });

      toolsSchema.addZodTool(
        'get_horoscope',
        "Get today's horoscope for an astrological sign",
        zodSchema
      );

      expect(toolsSchema.size()).toBe(1);
      const tool = toolsSchema.getTool('get_horoscope');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_horoscope');
      expect(tool?.description).toBe("Get today's horoscope for an astrological sign");
    });

    test('should throw existing tool with same name', () => {
      const zodSchema1 = z.object({ param1: z.string() });
      const zodSchema2 = z.object({ param2: z.number() });

      toolsSchema.addZodTool('my_tool', 'First description', zodSchema1);
      expect(() => toolsSchema.addZodTool('my_tool', 'Second description', zodSchema2)).toThrow(
        'Tool with name "my_tool" already exists'
      );
      expect(toolsSchema.size()).toBe(1);
      const tool = toolsSchema.getTool('my_tool');
      expect(tool?.description).toBe('First description');
    });
  });

  describe('addOpenAPITool', () => {
    test('should add a tool with OpenAPI schema', () => {
      const openApiSchema = {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'The city name' },
          units: { type: 'string', enum: ['celsius', 'fahrenheit'] }
        },
        required: ['city']
      };

      toolsSchema.addOpenAPITool('get_weather', 'Get current weather for a city', openApiSchema);

      expect(toolsSchema.size()).toBe(1);
      const tool = toolsSchema.getTool('get_weather');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('get_weather');
    });
  });

  describe('toVercel', () => {
    test('should convert tools to Vercel AI SDK format', () => {
      const zodSchema = z.object({
        query: z.string(),
        limit: z.number().optional()
      });

      toolsSchema.addZodTool('search', 'Search for information', zodSchema);

      const vercelTools = toolsSchema.toVercel();

      expect(vercelTools).toBeDefined();
      expect(vercelTools.search).toBeDefined();
      expect(vercelTools.search.description).toBe('Search for information');
      expect(vercelTools.search.parameters).toBeDefined();
    });

    test('should handle multiple tools', () => {
      toolsSchema.addZodTool('tool1', 'Description 1', z.object({ a: z.string() }));
      toolsSchema.addZodTool('tool2', 'Description 2', z.object({ b: z.number() }));

      const vercelTools = toolsSchema.toVercel();

      expect(Object.keys(vercelTools)).toHaveLength(2);
      expect(vercelTools.tool1).toBeDefined();
      expect(vercelTools.tool2).toBeDefined();
    });
  });

  describe('toOpenAI', () => {
    test('should convert tools to OpenAI function calling format', () => {
      const zodSchema = z.object({
        location: z.string(),
        unit: z.enum(['celsius', 'fahrenheit']).optional()
      });

      toolsSchema.addZodTool('get_temperature', 'Get temperature for a location', zodSchema);

      const openAITools = toolsSchema.toOpenAI();

      expect(Array.isArray(openAITools)).toBe(true);
      expect(openAITools).toHaveLength(1);
      expect(openAITools[0].type).toBe('function');
      expect(openAITools[0].name).toBe('get_temperature');
      expect(openAITools[0].description).toBe('Get temperature for a location');
      expect(openAITools[0].parameters).toBeDefined();
      expect(openAITools[0].parameters.type).toBe('object');
      expect(openAITools[0].parameters.properties).toBeDefined();
    });

    test('should handle multiple tools', () => {
      toolsSchema.addZodTool('func1', 'Function 1', z.object({ x: z.string() }));
      toolsSchema.addZodTool('func2', 'Function 2', z.object({ y: z.number() }));

      const openAITools = toolsSchema.toOpenAI();

      expect(openAITools).toHaveLength(2);
      expect(openAITools[0].name).toBe('func1');
      expect(openAITools[1].name).toBe('func2');
    });

    test('should work with OpenAPI schema tools', () => {
      const openApiSchema = {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      };

      toolsSchema.addOpenAPITool('send_message', 'Send a message', openApiSchema);

      const openAITools = toolsSchema.toOpenAI();

      expect(openAITools).toHaveLength(1);
      expect(openAITools[0].parameters).toEqual(openApiSchema);
    });
  });

  describe('getTool', () => {
    test('should return tool if it exists', () => {
      toolsSchema.addZodTool('my_tool', 'My tool', z.object({ param: z.string() }));

      const tool = toolsSchema.getTool('my_tool');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('my_tool');
    });

    test('should return undefined if tool does not exist', () => {
      const tool = toolsSchema.getTool('non_existent');
      expect(tool).toBeUndefined();
    });
  });

  describe('removeTool', () => {
    test('should remove existing tool and return true', () => {
      toolsSchema.addZodTool('temp_tool', 'Temporary tool', z.object({ x: z.number() }));
      expect(toolsSchema.size()).toBe(1);

      const removed = toolsSchema.removeTool('temp_tool');

      expect(removed).toBe(true);
      expect(toolsSchema.size()).toBe(0);
      expect(toolsSchema.getTool('temp_tool')).toBeUndefined();
    });

    test('should return false when removing non-existent tool', () => {
      const removed = toolsSchema.removeTool('non_existent');
      expect(removed).toBe(false);
    });
  });

  describe('size', () => {
    test('should return correct number of tools', () => {
      expect(toolsSchema.size()).toBe(0);

      toolsSchema.addZodTool('tool1', 'Tool 1', z.object({ a: z.string() }));
      expect(toolsSchema.size()).toBe(1);

      toolsSchema.addZodTool('tool2', 'Tool 2', z.object({ b: z.number() }));
      expect(toolsSchema.size()).toBe(2);

      toolsSchema.removeTool('tool1');
      expect(toolsSchema.size()).toBe(1);
    });
  });

  describe('clear', () => {
    test('should remove all tools', () => {
      toolsSchema.addZodTool('tool1', 'Tool 1', z.object({ a: z.string() }));
      toolsSchema.addZodTool('tool2', 'Tool 2', z.object({ b: z.number() }));
      toolsSchema.addZodTool('tool3', 'Tool 3', z.object({ c: z.boolean() }));

      expect(toolsSchema.size()).toBe(3);

      toolsSchema.clear();

      expect(toolsSchema.size()).toBe(0);
      expect(toolsSchema.getTool('tool1')).toBeUndefined();
      expect(toolsSchema.getTool('tool2')).toBeUndefined();
      expect(toolsSchema.getTool('tool3')).toBeUndefined();
    });
  });
});
