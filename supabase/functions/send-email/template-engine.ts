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

      itemHtml = itemHtml.replace(/\{\{this\.([a-zA-Z0-9_]+)\}\}/g, (_: string, key: string) => {
        return item[key] !== undefined && item[key] !== null ? String(item[key]) : '';
      });

      itemHtml = itemHtml.replace(/\{\{@index\}\}/g, String(index));

      return itemHtml;
    }).join('');
  });
}

function processIf(html: string, data: TemplateData): string {
  const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

  return html.replace(ifRegex, (match, condition, template) => {
    const value = getNestedValue(data, condition);
    return value ? template : '';
  });
}

export function renderTemplate(template: string, data: TemplateData): string {
  let html = template;

  html = processIf(html, data);
  html = processEach(html, data);

  html = html.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, path) => {
    const value = getNestedValue(data, path);
    return value !== undefined && value !== null ? String(value) : '';
  });

  return html;
}
