export interface TemplateData {
  [key: string]: any;
}

function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value === null || value === undefined) {
      return '';
    }
    value = value[key];
  }

  return value !== undefined && value !== null ? value : '';
}

function processEach(html: string, data: TemplateData): string {
  const eachRegex = /\{\{#each\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return html.replace(eachRegex, (match, arrayPath, template) => {
    const arrayData = getNestedValue(data, arrayPath);

    if (!Array.isArray(arrayData)) {
      console.warn(`{{#each ${arrayPath}}} - not an array or not found`);
      return '';
    }

    return arrayData.map((item, index) => {
      let itemHtml = template;

      if (typeof item === 'object' && item !== null) {
        for (const [key, value] of Object.entries(item)) {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          const displayValue = value !== undefined && value !== null ? String(value) : '';
          itemHtml = itemHtml.replace(regex, displayValue);
        }
      } else {
        const itemRegex = /\{\{this\}\}/g;
        itemHtml = itemHtml.replace(itemRegex, String(item));
      }

      const indexRegex = /\{\{@index\}\}/g;
      itemHtml = itemHtml.replace(indexRegex, String(index));

      const numberRegex = /\{\{@number\}\}/g;
      itemHtml = itemHtml.replace(numberRegex, String(index + 1));

      return itemHtml;
    }).join('');
  });
}

function processIf(html: string, data: TemplateData): string {
  const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)(\{\{\/if\}\}|\{\{else\}\}[\s\S]*?\{\{\/if\}\})/g;

  return html.replace(ifRegex, (match, condition, ifContent, elseBlock) => {
    const value = getNestedValue(data, condition);
    const isTruthy = Boolean(value) && value !== '' && value !== '0' && value !== 'false';

    if (elseBlock.startsWith('{{else}}')) {
      const elseContent = elseBlock.replace('{{else}}', '').replace('{{/if}}', '');
      return isTruthy ? ifContent : elseContent;
    } else {
      return isTruthy ? ifContent : '';
    }
  });
}

function processVariables(html: string, data: TemplateData): string {
  const variableRegex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

  return html.replace(variableRegex, (match, path) => {
    if (path.startsWith('@') || path === 'this') {
      return match;
    }

    const value = getNestedValue(data, path);
    return value !== undefined && value !== null ? String(value) : '';
  });
}

export function renderTemplate(template: string, data: TemplateData): string {
  let result = template;

  result = processEach(result, data);

  result = processIf(result, data);

  result = processVariables(result, data);

  const leftoverEach = /\{\{#each[\s\S]*?\{\{\/each\}\}/g;
  result = result.replace(leftoverEach, '');

  const leftoverIf = /\{\{#if[\s\S]*?\{\{\/if\}\}/g;
  result = result.replace(leftoverIf, '');

  const leftoverVariables = /\{\{[^}]+\}\}/g;
  result = result.replace(leftoverVariables, '');

  return result;
}

export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const eachOpen = (template.match(/\{\{#each/g) || []).length;
  const eachClose = (template.match(/\{\{\/each\}\}/g) || []).length;
  if (eachOpen !== eachClose) {
    errors.push(`Mismatched {{#each}} tags: ${eachOpen} opening, ${eachClose} closing`);
  }

  const ifOpen = (template.match(/\{\{#if/g) || []).length;
  const ifClose = (template.match(/\{\{\/if\}\}/g) || []).length;
  if (ifOpen !== ifClose) {
    errors.push(`Mismatched {{#if}} tags: ${ifOpen} opening, ${ifClose} closing`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
