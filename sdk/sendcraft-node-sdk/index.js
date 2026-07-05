const DEFAULT_BASE_URL = "https://api.sendcraft.net";

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
}

function buildUrl(baseUrl, path) {
  return normalizeBaseUrl(baseUrl) + "/" + String(path).replace(/^\/+/, "");
}

function appendQueryParams(url, query) {
  const resolved = new URL(url);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    resolved.searchParams.set(key, String(value));
  });
  return resolved.toString();
}

function extractMessage(payload, status) {
  if (payload && typeof payload === "object") {
    if (typeof payload.error === "string") return payload.error;
    if (payload.error && typeof payload.error === "object" && typeof payload.error.message === "string") return payload.error.message;
    if (typeof payload.message === "string") return payload.message;
  }
  return "Request failed (" + status + ")";
}

export class SendCraftError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "SendCraftError";
    this.status = status;
    this.details = details;
  }
}

export class SendCraftClient {
  constructor(options = {}) {
    const { baseUrl = DEFAULT_BASE_URL, apiKey = "", fetchImpl = globalThis.fetch?.bind(globalThis) } = options;
    if (!fetchImpl) {
      throw new Error("fetch is not available in this runtime");
    }
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.apiKey = String(apiKey || "").trim();
    this.fetchImpl = fetchImpl;
  }

  async request(path, options = {}) {
    const url = appendQueryParams(buildUrl(this.baseUrl, path), options.query);
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined && options.body !== null) {
      headers["Content-Type"] = "application/json";
    }
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    const response = await this.fetchImpl(url, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined && options.body !== null ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok || (payload && typeof payload === "object" && payload.success === false)) {
      throw new SendCraftError(extractMessage(payload, response.status), response.status, payload);
    }

    return payload;
  }

  sendEmail(payload) {
    return this.request("/send-email", { method: "POST", body: payload });
  }

  sendEmailWithPdf(payload) {
    return this.request("/send-email-with-pdf", { method: "POST", body: payload });
  }

  generatePdf(payload) {
    return this.request("/generate-pdf", { method: "POST", body: payload });
  }

  notify(payload) {
    return this.request("/notify", { method: "POST", body: payload });
  }

  notifyStatus(jobId) {
    return this.request("/notify/" + encodeURIComponent(String(jobId)), { method: "GET" });
  }

  listPrograms(query = {}) {
    return this.request("/automation-programs", { method: "GET", query });
  }

  createProgram(payload) {
    return this.request("/automation-programs", { method: "POST", body: payload });
  }

  updateProgram(programId, payload) {
    return this.request("/automation-programs/" + encodeURIComponent(String(programId)), { method: "PUT", body: payload });
  }

  deleteProgram(programId) {
    return this.request("/automation-programs/" + encodeURIComponent(String(programId)), { method: "DELETE" });
  }

  runProgram(programId) {
    return this.request("/automation-programs/" + encodeURIComponent(String(programId)) + "/run", { method: "POST" });
  }

  loadProgramQueue(programId, query = {}) {
    return this.request("/automation-programs/" + encodeURIComponent(String(programId)) + "/queue", { method: "GET", query });
  }

  enqueueProgramQueue(programId, payload) {
    return this.request("/automation-programs/" + encodeURIComponent(String(programId)) + "/queue", { method: "POST", body: payload });
  }

  cancelProgramQueueItem(programId, queueItemId) {
    return this.request("/automation-programs/" + encodeURIComponent(String(programId)) + "/queue/" + encodeURIComponent(String(queueItemId)), { method: "DELETE" });
  }

  loadMonitoring(query = {}) {
    return this.request("/automation-monitoring", { method: "GET", query });
  }
}

export default SendCraftClient;