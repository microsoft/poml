import { z } from 'zod';
import { jsonSchemaToZod } from 'json-schema-to-zod';

/**
 * A unified schema representation that can work with both Zod and OpenAPI schemas.
 * Provides conversion methods between different schema formats.
 */
export class Schema {

  private constructor(
    private zodSchema?: z.ZodTypeAny,
    private openApiSchema?: any
  ) {
    if (!zodSchema && !openApiSchema) {
      throw new Error("At least one schema must be provided");
    }
    this.zodSchema = zodSchema;
    this.openApiSchema = openApiSchema;
  }

  /**
   * Creates a Schema instance from an OpenAPI schema object.
   * @param openApiSchema The OpenAPI schema object
   * @returns A new Schema instance
   */
  public static fromOpenAPI(openApiSchema: any): Schema {
    const schema = new Schema(undefined, openApiSchema);
    // TODO: openapi schema full validation should be added here
    if (typeof openApiSchema !== 'object' || openApiSchema === null) {
      throw new Error("Invalid OpenAPI schema provided");
    }
    return schema;
  }

  /**
   * Creates a Schema instance from a Zod schema.
   * @param zodSchema The Zod schema
   * @returns A new Schema instance
   */
  public static fromZod(zodSchema: z.ZodTypeAny): Schema {
    return new Schema(zodSchema);
  }

  /**
   * Converts the schema to a Zod schema.
   * @returns The Zod schema representation
   * @throws Error if no schema is available
   */
  public toZod(): z.ZodTypeAny {
    if (this.zodSchema) {
      return this.zodSchema;
    } else if (this.openApiSchema) {
      // It's not safe and even prohibited to use eval in browser environments.
      // We need to make z available in the eval context
      const zodSchemaString = jsonSchemaToZod(this.openApiSchema);
      // Create a function that has z in scope and evaluate the schema string
      const evalWithZ = new Function('z', `return ${zodSchemaString}`);
      return evalWithZ(z) as z.ZodTypeAny;
    } else {
      throw new Error("No Zod schema available");
    }
  }

  /**
   * Converts the schema to an OpenAPI/JSON schema format.
   * @returns The OpenAPI schema representation
   * @throws Error if no schema is available
   */
  public toOpenAPI(): any {
    if (this.openApiSchema) {
      return this.openApiSchema;
    } else if (this.zodSchema) {
      const schema = z.toJSONSchema(this.zodSchema);
      // pop the $schema property if it exists
      if (schema.$schema) {
        delete schema.$schema;
      }
      return schema;
    } else {
      throw new Error("No schema available");
    }
  }
}

/**
 * Represents a tool schema with name, description, and input parameters.
 */
interface ToolSchema {
  name: string;
  description: string | undefined;
  inputSchema: Schema;
}

/**
 * Manages a collection of tool schemas and provides conversion methods
 * for different AI provider formats (OpenAI, Vercel, etc.).
 */
export class ToolsSchema {
  private tools: Map<string, ToolSchema>;

  public constructor() {
    this.tools = new Map<string, ToolSchema>();
  }

  /**
   * Adds a tool with a Zod schema to the collection.
   * @param name The name of the tool
   * @param description A description of what the tool does
   * @param zodSchema The Zod schema for the tool's input parameters
   */
  public addZodTool(name: string, description: string | undefined, zodSchema: z.ZodTypeAny): void {
    const schema = Schema.fromZod(zodSchema);
    if (this.tools.has(name)) {
      throw new Error(`Tool with name "${name}" already exists`);
    }
    this.tools.set(name, {
      name,
      description,
      inputSchema: schema
    });
  }

  /**
   * Adds a tool with an OpenAPI schema to the collection.
   * @param name The name of the tool
   * @param description A description of what the tool does
   * @param openApiSchema The OpenAPI schema for the tool's input parameters
   */
  public addOpenAPITool(name: string, description: string | undefined, openApiSchema: any): void {
    const schema = Schema.fromOpenAPI(openApiSchema);
    if (this.tools.has(name)) {
      throw new Error(`Tool with name "${name}" already exists`);
    }
    this.tools.set(name, {
      name,
      description,
      inputSchema: schema
    });
  }

  /**
   * Add a tool with pre-parsed schema.
   * @param name The name of the tool
   * @param description A description of what the tool does
   * @param schema The pre-parsed schema for the tool's input parameters
   */
  public addTool(name: string, description: string | undefined, schema: Schema): void {
    if (this.tools.has(name)) {
      throw new Error(`Tool with name "${name}" already exists`);
    }
    this.tools.set(name, {
      name,
      description,
      inputSchema: schema
    });
  }

  /**
   * Converts the tools collection to Vercel AI SDK format.
   * @returns An object mapping tool names to their Vercel AI SDK representations
   */
  public toVercel(): any {
    const vercelTools: Record<string, any> = {};
    
    for (const [name, tool] of this.tools) {
      vercelTools[name] = {
        description: tool.description,
        parameters: tool.inputSchema.toZod()
      };
    }
    
    return vercelTools;
  }

  /**
   * Converts the tools collection to OpenAI function calling format.
   * @returns An array of OpenAI function definitions
   * @example
   * [
   *   {
   *     "type": "function",
   *     "name": "get_horoscope",
   *     "description": "Get today's horoscope for an astrological sign.",
   *     "parameters": {
   *       "type": "object",
   *       "properties": {
   *         "sign": {
   *           "type": "string",
   *           "description": "An astrological sign like Taurus or Aquarius"
   *         }
   *       },
   *       "required": ["sign"]
   *     }
   *   }
   * ]
   */
  public toOpenAI(): any {
    const openAITools: any[] = [];
    
    for (const [_, tool] of this.tools) {
      openAITools.push({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema.toOpenAPI()
      });
    }
    
    return openAITools;
  }

  /**
   * Gets a tool by name.
   * @param name The name of the tool to retrieve
   * @returns The tool schema if found, undefined otherwise
   */
  public getTool(name: string): ToolSchema | undefined {
    return this.tools.get(name);
  }

  /**
   * Removes a tool from the collection.
   * @param name The name of the tool to remove
   * @returns true if the tool was removed, false if it didn't exist
   */
  public removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Gets the number of tools in the collection.
   * @returns The number of tools
   */
  public size(): number {
    return this.tools.size;
  }

  /**
   * Clears all tools from the collection.
   */
  public clear(): void {
    this.tools.clear();
  }

}