import { ComponentSpec, Parameter, PomlComponent } from 'poml/base';

export function formatComponentDocumentation(componentSpec: ComponentSpec, baseLevel?: number): string {
  baseLevel = baseLevel || 2;
  const docParts: string[] = [];
  docParts.push(componentSpec.description);
  if (componentSpec.example) {
    docParts.push('#'.repeat(baseLevel) + ' Usages', componentSpec.example);
  }
  const component = PomlComponent.fromSpec(componentSpec);
  const params = component.parameters();
  if (params.length > 0) {
    docParts.push(
      '#'.repeat(baseLevel) + ' Parameters',
      params
        .map((param) => {
          return '- ' + formatParameterDocumentation(param);
        })
        .join('\n'),
    );
  }
  return docParts.join('\n\n');
}

export function formatParameterDocumentation(param: Parameter): string {
  let desc: string = '';
  if (param.type !== 'string' && param.type.length >= 1) {
    desc += param.type.charAt(0).toUpperCase() + param.type.slice(1) + '. ';
  }
  if (param.choices.length > 0) {
    desc += 'Can be one of: ' + param.choices.join(', ') + '. ';
  }
  desc += param.description;
  return `**${param.name}**: ${desc.replaceAll('\n', '\n  ')}`;
}
