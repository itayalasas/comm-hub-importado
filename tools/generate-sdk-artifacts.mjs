import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from 'node:module';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const templatesPath = path.join(projectRoot, 'src', 'lib', 'sdkTemplates.ts');
const sdkRoot = path.join(projectRoot, 'sdk');
const defaultBaseUrl = process.env.SDK_BASE_URL?.trim() || 'https://api.sendcraft.net';

async function transpileSdkTemplates() {
  const source = await fs.readFile(templatesPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      sourceMap: false,
    },
    fileName: templatesPath,
  }).outputText;

  const mod = new Module(templatesPath);
  mod.filename = templatesPath;
  mod.paths = Module._nodeModulePaths(projectRoot);
  mod._compile(output, templatesPath);
  return mod.exports;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeFileSafe(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeBundle(bundle) {
  const targetDir = path.join(sdkRoot, bundle.folderName);
  await ensureDir(targetDir);

  for (const [relativePath, content] of Object.entries(bundle.files)) {
    await writeFileSafe(path.join(targetDir, relativePath), content);
  }
}

function toOpenApiPath(pathTemplate) {
  return String(pathTemplate).replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function buildMarketplaceOpenApiSpec(groups, baseUrl) {
  const apiKeyHeader = {
    type: 'apiKey',
    in: 'header',
    name: 'x-api-key',
    description: 'API key de la aplicacion.',
  };

  const genericError = {
    type: 'object',
    properties: {
      error: { type: 'string' },
      detail: { type: 'string' },
    },
    additionalProperties: true,
  };

  const genericObject = {
    type: 'object',
    additionalProperties: true,
  };

  const paths = {};

  for (const group of groups) {
    for (const action of group.actions) {
      const pathKey = toOpenApiPath(action.path);
      const methodKey = action.method.toLowerCase();
      const pathParams = Array.from(action.path.matchAll(/:([A-Za-z0-9_]+)/g)).map((match) => ({
        name: match[1],
        in: 'path',
        required: true,
        schema: { type: 'string' },
      }));

      const operation = {
        tags: [group.name],
        summary: action.name,
        description: action.description,
        security: [{ ApiKeyAuth: [] }],
        parameters: pathParams,
        responses: {
          200: {
            description: 'OK',
            content: {
              'application/json': {
                schema: genericObject,
              },
            },
          },
          400: {
            description: 'Solicitud invalida',
            content: {
              'application/json': {
                schema: genericError,
              },
            },
          },
        },
      };

      if (methodKey !== 'get') {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: genericObject,
            },
          },
        };
      }

      if (!paths[pathKey]) {
        paths[pathKey] = {};
      }

      paths[pathKey][methodKey] = operation;
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'SendCraft API',
      version: '1.0.0',
      description: 'API publica del Marketplace de SendCraft: email, PDF, notificaciones, automatizaciones y tracking.',
    },
    servers: [
      {
        url: baseUrl,
        description: 'Produccion',
      },
    ],
    security: [{ ApiKeyAuth: [] }],
    components: {
      securitySchemes: { ApiKeyAuth: apiKeyHeader },
      schemas: {
        ErrorResponse: genericError,
        GenericObject: genericObject,
      },
    },
    paths,
  };
}

async function main() {
  const sdkTemplates = await transpileSdkTemplates();

  await fs.rm(sdkRoot, { recursive: true, force: true });
  await ensureDir(sdkRoot);

  for (const language of ['node', 'dotnet', 'java']) {
    const bundle = sdkTemplates.buildSdkBundle(language, defaultBaseUrl);
    await writeBundle(bundle);
  }

  const openApiPath = path.join(sdkRoot, 'openapi', 'sendcraft.openapi.json');
  await writeFileSafe(
    openApiPath,
    JSON.stringify(buildMarketplaceOpenApiSpec(sdkTemplates.MARKETPLACE_SDK_GROUPS, defaultBaseUrl), null, 2) + '\n',
  );

  await writeFileSafe(
    path.join(sdkRoot, 'README.md'),
    [
      '# SendCraft SDKs',
      '',
      'Paquetes listos para publicar y consumir desde Node.js, .NET y Java.',
      '',
      '## Estructura',
      '',
      '- `sdk/openapi/sendcraft.openapi.json` contiene la especificacion OpenAPI 3.1',
      '- `sdk/sendcraft-node-sdk` contiene el cliente para Node.js',
      '- `sdk/SendCraft.Sdk` contiene el cliente para .NET',
      '- `sdk/sendcraft-java-sdk` contiene el cliente para Java',
      '',
      '## Publicacion',
      '',
      '- Node: `npm publish` desde `sdk/sendcraft-node-sdk`',
      '- .NET: `dotnet pack` y luego `dotnet nuget push` desde `sdk/SendCraft.Sdk`',
      '- Java: `mvn deploy` o `mvn install` desde `sdk/sendcraft-java-sdk`',
      '',
      '## Catalogo publico',
      '',
      `${sdkTemplates.MARKETPLACE_SDK_GROUPS.length} grupos oficiales, ${sdkTemplates.SDK_SUPPORT_SUMMARY.length} endpoints publicos.`,
      '- `npm run sdk:status` lista el catalogo y puede probar una URL con `--base-url=...` o `SDK_BASE_URL`.',
      '',
      '## Regeneracion',
      '',
      `Ejecuta \`node tools/generate-sdk-artifacts.mjs\` para volver a materializar los paquetes con base URL ${defaultBaseUrl}.`,
      '',
    ].join('\n'),
  );

  console.log('SDK artifacts generated at', sdkRoot);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
