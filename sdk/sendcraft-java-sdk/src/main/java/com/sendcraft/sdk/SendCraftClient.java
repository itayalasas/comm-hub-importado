package com.sendcraft.sdk;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SendCraftClient {
    private static final String DEFAULT_BASE_URL = "https://api.sendcraft.net";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String apiKey;

    public SendCraftClient(String baseUrl) {
        this(baseUrl, null, null);
    }

    public SendCraftClient(String baseUrl, String apiKey) {
        this(baseUrl, apiKey, null);
    }

    public SendCraftClient(String baseUrl, String apiKey, HttpClient httpClient) {
        this.baseUrl = normalizeBaseUrl(baseUrl);
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.httpClient = httpClient == null ? HttpClient.newHttpClient() : httpClient;
        this.objectMapper = new ObjectMapper();
    }

    public JsonNode sendEmail(Map<String, Object> payload) throws IOException, InterruptedException {
        return request("POST", "/send-email", payload, null);
    }

    public JsonNode sendEmailWithPdf(Map<String, Object> payload) throws IOException, InterruptedException {
        return request("POST", "/send-email-with-pdf", payload, null);
    }

    public JsonNode generatePdf(Map<String, Object> payload) throws IOException, InterruptedException {
        return request("POST", "/generate-pdf", payload, null);
    }

    public JsonNode notify(Map<String, Object> payload) throws IOException, InterruptedException {
        return request("POST", "/notify", payload, null);
    }

    public JsonNode notifyStatus(String jobId) throws IOException, InterruptedException {
        return request("GET", "/notify/" + encode(jobId), null, null);
    }

    public JsonNode listPrograms(Map<String, Object> query) throws IOException, InterruptedException {
        return request("GET", "/automation-programs", null, query);
    }

    public JsonNode createProgram(Map<String, Object> payload) throws IOException, InterruptedException {
        return request("POST", "/automation-programs", payload, null);
    }

    public JsonNode updateProgram(String programId, Map<String, Object> payload) throws IOException, InterruptedException {
        return request("PUT", "/automation-programs/" + encode(programId), payload, null);
    }

    public JsonNode deleteProgram(String programId) throws IOException, InterruptedException {
        return request("DELETE", "/automation-programs/" + encode(programId), null, null);
    }

    public JsonNode runProgram(String programId) throws IOException, InterruptedException {
        return request("POST", "/automation-programs/" + encode(programId) + "/run", null, null);
    }

    public JsonNode loadProgramQueue(String programId, Map<String, Object> query) throws IOException, InterruptedException {
        return request("GET", "/automation-programs/" + encode(programId) + "/queue", null, query);
    }

    public JsonNode enqueueProgramQueue(String programId, Map<String, Object> payload) throws IOException, InterruptedException {
        return request("POST", "/automation-programs/" + encode(programId) + "/queue", payload, null);
    }

    public JsonNode cancelProgramQueueItem(String programId, String queueItemId) throws IOException, InterruptedException {
        return request("DELETE", "/automation-programs/" + encode(programId) + "/queue/" + encode(queueItemId), null, null);
    }

    public JsonNode loadMonitoring(Map<String, Object> query) throws IOException, InterruptedException {
        return request("GET", "/automation-monitoring", null, query);
    }

    private JsonNode request(String method, String path, Map<String, Object> body, Map<String, Object> query) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(buildUri(path, query))).method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8));
        builder.header("Accept", "application/json");
        if (body != null) {
            builder.header("Content-Type", "application/json");
        }
        if (!apiKey.isBlank()) {
            builder.header("x-api-key", apiKey);
        }

        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        JsonNode payload = response.body() == null || response.body().isBlank() ? null : objectMapper.readTree(response.body());
        if (response.statusCode() >= 400 || isFailurePayload(payload)) {
            throw new SendCraftException(buildErrorMessage(payload, response.statusCode()), response.statusCode(), payload);
        }
        return payload;
    }

    private String buildUri(String path, Map<String, Object> query) {
        String uri = combine(baseUrl, path);
        if (query == null || query.isEmpty()) {
            return uri;
        }
        List<String> params = new ArrayList<>();
        for (Map.Entry<String, Object> entry : query.entrySet()) {
            if (entry.getValue() == null) {
                continue;
            }
            String text = entry.getValue().toString();
            if (text.isBlank()) {
                continue;
            }
            params.add(encode(entry.getKey()) + "=" + encode(text));
        }
        if (params.isEmpty()) {
            return uri;
        }
        return uri + "?" + String.join("&", params);
    }

    private static String combine(String base, String path) {
        return base.replaceAll("/+$", "") + "/" + path.replaceAll("^/+", "");
    }

    private static String normalizeBaseUrl(String value) {
        if (value == null || value.isBlank()) {
            return DEFAULT_BASE_URL;
        }
        return value.trim().replaceAll("/+$", "");
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static boolean isFailurePayload(JsonNode payload) {
        if (payload == null) {
            return false;
        }
        JsonNode success = payload.get("success");
        if (success != null && success.isBoolean() && !success.booleanValue()) {
            return true;
        }
        return payload.hasNonNull("error");
    }

    private static String buildErrorMessage(JsonNode payload, int statusCode) {
        if (payload != null) {
            JsonNode error = payload.get("error");
            if (error != null && error.isTextual()) {
                return error.asText();
            }
            JsonNode message = payload.get("message");
            if (message != null && message.isTextual()) {
                return message.asText();
            }
        }
        return "Request failed (" + statusCode + ")";
    }
}