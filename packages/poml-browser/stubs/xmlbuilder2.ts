// Browser-safe xmlbuilder2 stub for poml-browser
// xmlbuilder2 is used for creating XML and HTML documents
// In browser context, this functionality is limited

export interface XMLBuilderNode {
  end(options?: { prettyPrint?: boolean; headless?: boolean }): string;
  ele(name: string, attributes?: Record<string, any>, content?: string): XMLBuilderNode;
  att(attributes: Record<string, any>): XMLBuilderNode;
  txt(content: string): XMLBuilderNode;
  root(): XMLBuilderNode;
}

class XMLBuilderStub implements XMLBuilderNode {
  private content: string = '';
  private tagStack: string[] = [];

  end(options?: { prettyPrint?: boolean; headless?: boolean }): string {
    throw new Error(
      'XML building is not available in browser context. XML document creation requires server-side processing.',
    );
  }

  ele(name: string, attributes?: Record<string, any>, content?: string): XMLBuilderNode {
    return new XMLBuilderStub();
  }

  att(attributes: Record<string, any>): XMLBuilderNode {
    return this;
  }

  txt(content: string): XMLBuilderNode {
    return this;
  }

  root(): XMLBuilderNode {
    return this;
  }
}

export function create(): XMLBuilderNode {
  return new XMLBuilderStub();
}

export function fragment(): XMLBuilderNode {
  return new XMLBuilderStub();
}

export default {
  create,
  fragment,
};
