import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(projectRoot, 'src', 'lib', 'marketplace-sdk-catalog.json');

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function resolveBaseUrl() {
  const cliBaseUrlFlag = process.argv.find((arg) => arg.startsWith('--base-url='));
  const cliBaseUrl = cliBaseUrlFlag ? cliBaseUrlFlag.slice('--base-url='.length) : '';

  return normalizeBaseUrl(
    cliBaseUrl ||
    process.env.SDK_BASE_URL ||
    process.env.FUNCTIONS_BASE_URL ||
    process.env.VITE_FUNCTIONS_BASE_URL ||
    '',
  );
}

function sampleValueForParam(paramName) {
  switch (String(paramName || '').toLowerCase()) {
    case 'job_id':
      return 'sample-job-id';
    case 'programid':
    case 'program_id':
      return 'sample-program-id';
    case 'queueitemid':
    case 'queue_item_id':
      return 'sample-queue-item-id';
    case 'log_id':
      return 'sample-log-id';
    default:
      return `sample-${String(paramName || 'value').toLowerCase()}`;
  }
}

function buildUrl(baseUrl, actionPath) {
  const replacedPath = String(actionPath).replace(/:([A-Za-z0-9_]+)/g, (_, paramName) => sampleValueForParam(paramName));
  return `${baseUrl.replace(/\/+$/, '')}/${replacedPath.replace(/^\/+/, '')}`;
}

function collectPathParams(actionPath) {
  return Array.from(String(actionPath).matchAll(/:([A-Za-z0-9_]+)/g)).map((match) => match[1]);
}

function classifyStatus(status) {
  if (status === 404) {
    return { deployed: false, label: 'missing' };
  }

  if ([200, 204, 401, 403, 405].includes(status)) {
    return { deployed: true, label: 'live' };
  }

  return { deployed: null, label: 'check' };
}

async function main() {
  const raw = await fs.readFile(catalogPath, 'utf8');
  const catalog = JSON.parse(raw);
  const groups = Array.isArray(catalog.groups) ? catalog.groups : [];
  const baseUrl = resolveBaseUrl();
  const endpoints = groups.flatMap((group) =>
    group.actions.map((action) => ({
      group: group.name,
      action,
      sampleUrl: buildUrl(baseUrl, action.path),
      pathParams: collectPathParams(action.path),
    }))
  );

  console.log(`SendCraft public SDK catalog`);
  console.log(`Base URL: ${baseUrl || '(not set)'}`);
  console.log(`Groups: ${groups.length}`);
  console.log(`Endpoints: ${endpoints.length}`);
  console.log('');
  console.log('Group | Method | Path | Deployed | Status');
  console.log('--- | --- | --- | --- | ---');

  if (!baseUrl) {
    for (const endpoint of endpoints) {
      const pathLabel = endpoint.pathParams.length
        ? `${endpoint.action.path} (${endpoint.pathParams.join(', ')})`
        : endpoint.action.path;

      console.log(`${endpoint.group} | ${endpoint.action.method} | ${pathLabel} | unknown | set SDK_BASE_URL or pass --base-url to probe`);
    }

    return;
  }

  for (const endpoint of endpoints) {
    let statusText = 'not checked';
    let deployedLabel = 'unknown';

    try {
      const response = await fetch(endpoint.sampleUrl, {
        method: 'OPTIONS',
        headers: {
          Accept: 'application/json',
        },
      });

      const classification = classifyStatus(response.status);
      deployedLabel = classification.deployed === true ? 'yes' : classification.deployed === false ? 'no' : 'maybe';
      statusText = `${classification.label} (${response.status}${response.statusText ? ` ${response.statusText}` : ''})`;
    } catch (error) {
      deployedLabel = 'no';
      statusText = error instanceof Error ? error.message : String(error);
    }

    const pathLabel = endpoint.pathParams.length
      ? `${endpoint.action.path} (${endpoint.pathParams.join(', ')})`
      : endpoint.action.path;

    console.log(`${endpoint.group} | ${endpoint.action.method} | ${pathLabel} | ${deployedLabel} | ${statusText}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
