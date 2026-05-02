import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, "output");

function getNestedValue(obj, pathExpression) {
  const keys = pathExpression.split(".");
  let value = obj;

  for (const key of keys) {
    if (value === null || value === undefined) {
      return "";
    }
    value = value[key];
  }

  return value !== undefined && value !== null ? value : "";
}

function processEach(html, data) {
  const eachRegex = /\{\{#each\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

  return html.replace(eachRegex, (match, arrayPath, template) => {
    const arrayData = getNestedValue(data, arrayPath);

    if (!Array.isArray(arrayData)) {
      return "";
    }

    return arrayData
      .map((item, index) => {
        let itemHtml = template;

        if (typeof item === "object" && item !== null) {
          const ifGtRegex = /\{\{#if_gt\s+([a-zA-Z0-9_.]+)\s+(\d+(?:\.\d+)?)\}\}([\s\S]*?)(\{\{\/if_gt\}\}|\{\{else\}\}[\s\S]*?\{\{\/if_gt\}\})/g;
          itemHtml = itemHtml.replace(ifGtRegex, (m, varPath, threshold, ifContent, elseBlock) => {
            const value = item[varPath];
            const numValue = parseFloat(String(value));
            const numThreshold = parseFloat(threshold);
            const isGreater = !Number.isNaN(numValue) && numValue > numThreshold;

            if (elseBlock.startsWith("{{else}}")) {
              const elseContent = elseBlock.replace("{{else}}", "").replace("{{/if_gt}}", "");
              return isGreater ? ifContent : elseContent;
            }

            return isGreater ? ifContent : "";
          });

          for (const [key, value] of Object.entries(item)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
            const displayValue = value !== undefined && value !== null ? String(value) : "";
            itemHtml = itemHtml.replace(regex, displayValue);
          }
        } else {
          itemHtml = itemHtml.replace(/\{\{this\}\}/g, String(item));
        }

        itemHtml = itemHtml.replace(/\{\{@index\}\}/g, String(index));
        itemHtml = itemHtml.replace(/\{\{@number\}\}/g, String(index + 1));

        return itemHtml;
      })
      .join("");
  });
}

function processIfGt(html, data) {
  const ifGtRegex = /\{\{#if_gt\s+([a-zA-Z0-9_.]+)\s+(\d+(?:\.\d+)?)\}\}([\s\S]*?)(\{\{\/if_gt\}\}|\{\{else\}\}[\s\S]*?\{\{\/if_gt\}\})/g;

  return html.replace(ifGtRegex, (match, varPath, threshold, ifContent, elseBlock) => {
    const value = getNestedValue(data, varPath);
    const numValue = parseFloat(String(value));
    const numThreshold = parseFloat(threshold);
    const isGreater = !Number.isNaN(numValue) && numValue > numThreshold;

    if (elseBlock.startsWith("{{else}}")) {
      const elseContent = elseBlock.replace("{{else}}", "").replace("{{/if_gt}}", "");
      return isGreater ? ifContent : elseContent;
    }

    return isGreater ? ifContent : "";
  });
}

function processIf(html, data) {
  const ifRegex = /\{\{#if\s+([a-zA-Z0-9_.]+)\}\}([\s\S]*?)(\{\{\/if\}\}|\{\{else\}\}[\s\S]*?\{\{\/if\}\})/g;

  return html.replace(ifRegex, (match, condition, ifContent, elseBlock) => {
    const value = getNestedValue(data, condition);
    const isTruthy = Boolean(value) && value !== "" && value !== "0" && value !== "false";

    if (elseBlock.startsWith("{{else}}")) {
      const elseContent = elseBlock.replace("{{else}}", "").replace("{{/if}}", "");
      return isTruthy ? ifContent : elseContent;
    }

    return isTruthy ? ifContent : "";
  });
}

function processVariables(html, data) {
  const variableRegex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;

  return html.replace(variableRegex, (match, pathExpression) => {
    if (pathExpression.startsWith("@") || pathExpression === "this") {
      return match;
    }

    const value = getNestedValue(data, pathExpression);
    return value !== undefined && value !== null ? String(value) : "";
  });
}

function renderTemplate(template, data) {
  let result = template;

  result = processEach(result, data);
  result = processIfGt(result, data);
  result = processIf(result, data);
  result = processVariables(result, data);

  result = result.replace(/\{\{#each[\s\S]*?\{\{\/each\}\}/g, "");
  result = result.replace(/\{\{#if_gt[\s\S]*?\{\{\/if_gt\}\}/g, "");
  result = result.replace(/\{\{#if[\s\S]*?\{\{\/if\}\}/g, "");
  result = result.replace(/\{\{[^}]+\}\}/g, "");

  return result;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const templatePath = path.join(__dirname, "template.html");
  const dataPath = path.join(__dirname, "sample-data.json");
  const renderedHtmlPath = path.join(outputDir, "rendered.html");
  const summaryPath = path.join(outputDir, "render-summary.json");

  const [template, rawData] = await Promise.all([
    fs.readFile(templatePath, "utf8"),
    fs.readFile(dataPath, "utf8")
  ]);

  const data = JSON.parse(rawData);
  const rendered = renderTemplate(template, data);

  await fs.writeFile(renderedHtmlPath, rendered, "utf8");
  await fs.writeFile(
    summaryPath,
    JSON.stringify(
      {
        rendered_html_path: renderedHtmlPath,
        rendered_length: rendered.length,
        sample_invoice: data.numero_cfe,
        generated_at: new Date().toISOString()
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(JSON.stringify({ ok: true, renderedHtmlPath, summaryPath }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
