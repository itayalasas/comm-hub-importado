import process from "node:process";

const DEFAULT_BASE_URL = "";
const GROUP_COUNT = 7;
const ENDPOINTS = [
  {
    "group": "SendCraft Email",
    "method": "POST",
    "path": "/send-email",
    "pathParams": []
  },
  {
    "group": "SendCraft Email + PDF",
    "method": "POST",
    "path": "/send-email-with-pdf",
    "pathParams": []
  },
  {
    "group": "SendCraft PDF Generator",
    "method": "POST",
    "path": "/generate-pdf",
    "pathParams": []
  },
  {
    "group": "SendCraft Notify",
    "method": "POST",
    "path": "/notify",
    "pathParams": []
  },
  {
    "group": "SendCraft Notify",
    "method": "GET",
    "path": "/notify/:job_id",
    "pathParams": [
      "job_id"
    ]
  },
  {
    "group": "SendCraft Programs",
    "method": "GET",
    "path": "/automation-programs",
    "pathParams": []
  },
  {
    "group": "SendCraft Programs",
    "method": "POST",
    "path": "/automation-programs",
    "pathParams": []
  },
  {
    "group": "SendCraft Programs",
    "method": "PUT",
    "path": "/automation-programs/:programId",
    "pathParams": [
      "programId"
    ]
  },
  {
    "group": "SendCraft Programs",
    "method": "DELETE",
    "path": "/automation-programs/:programId",
    "pathParams": [
      "programId"
    ]
  },
  {
    "group": "SendCraft Programs",
    "method": "POST",
    "path": "/automation-programs/:programId/run",
    "pathParams": [
      "programId"
    ]
  },
  {
    "group": "SendCraft Programs",
    "method": "GET",
    "path": "/automation-programs/:programId/queue",
    "pathParams": [
      "programId"
    ]
  },
  {
    "group": "SendCraft Programs",
    "method": "POST",
    "path": "/automation-programs/:programId/queue",
    "pathParams": [
      "programId"
    ]
  },
  {
    "group": "SendCraft Programs",
    "method": "DELETE",
    "path": "/automation-programs/:programId/queue/:queueItemId",
    "pathParams": [
      "programId",
      "queueItemId"
    ]
  },
  {
    "group": "SendCraft Monitoring",
    "method": "GET",
    "path": "/automation-monitoring",
    "pathParams": []
  },
  {
    "group": "SendCraft Webhooks",
    "method": "GET",
    "path": "/track-email/open",
    "pathParams": []
  },
  {
    "group": "SendCraft Webhooks",
    "method": "GET",
    "path": "/track-email/click",
    "pathParams": []
  }
];

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function resolveBaseUrl() {
  const cliBaseUrlFlag = process.argv.find((arg) => arg.startsWith("--base-url="));
  const cliBaseUrl = cliBaseUrlFlag ? cliBaseUrlFlag.slice("--base-url=".length) : "";
  return normalizeBaseUrl(
    cliBaseUrl ||
    process.env.SDK_BASE_URL ||
    process.env.FUNCTIONS_BASE_URL ||
    process.env.VITE_FUNCTIONS_BASE_URL ||
    DEFAULT_BASE_URL
  );
}

function sampleValueForParam(paramName) {
  switch (String(paramName || "").toLowerCase()) {
    case "job_id": return "sample-job-id";
    case "programid":
    case "program_id": return "sample-program-id";
    case "queueitemid":
    case "queue_item_id": return "sample-queue-item-id";
    case "log_id": return "sample-log-id";
    default: return `sample-${String(paramName || "value").toLowerCase()}`;
  }
}

function buildUrl(baseUrl, actionPath) {
  const replacedPath = String(actionPath).replace(/:([A-Za-z0-9_]+)/g, (_, paramName) => sampleValueForParam(paramName));
  return `${baseUrl.replace(/\/+$/, "")}/${replacedPath.replace(/^\/+/, "")}`;
}

function classifyStatus(status) {
  if (status === 404) return { deployed: false, label: "missing" };
  if ([200, 204, 401, 403, 405].includes(status)) return { deployed: true, label: "live" };
  return { deployed: null, label: "check" };
}

async function main() {
  const baseUrl = resolveBaseUrl();
  console.log("SendCraft public SDK catalog");
  console.log(`Base URL: ${baseUrl || "(not set)"}`);
  console.log(`Groups: ${GROUP_COUNT}`);
  console.log(`Endpoints: ${ENDPOINTS.length}`);
  console.log("");
  console.log("Group | Method | Path | Deployed | Status");
  console.log("--- | --- | --- | --- | ---");

  if (!baseUrl) {
    for (const endpoint of ENDPOINTS) {
      const pathLabel = endpoint.pathParams.length
        ? `${endpoint.path} (${endpoint.pathParams.join(", ")})`
        : endpoint.path;
      console.log(`${endpoint.group} | ${endpoint.method} | ${pathLabel} | unknown | set SDK_BASE_URL or pass --base-url to probe`);
    }
    return;
  }

  for (const endpoint of ENDPOINTS) {
    let statusText = "not checked";
    let deployedLabel = "unknown";
    try {
      const response = await fetch(buildUrl(baseUrl, endpoint.path), {
        method: "OPTIONS",
        headers: { Accept: "application/json" },
      });
      const classification = classifyStatus(response.status);
      deployedLabel = classification.deployed === true ? "yes" : classification.deployed === false ? "no" : "maybe";
      statusText = `${classification.label} (${response.status}${response.statusText ? ` ${response.statusText}` : ""})`;
    } catch (error) {
      deployedLabel = "no";
      statusText = error instanceof Error ? error.message : String(error);
    }

    const pathLabel = endpoint.pathParams.length
      ? `${endpoint.path} (${endpoint.pathParams.join(", ")})`
      : endpoint.path;
    console.log(`${endpoint.group} | ${endpoint.method} | ${pathLabel} | ${deployedLabel} | ${statusText}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});