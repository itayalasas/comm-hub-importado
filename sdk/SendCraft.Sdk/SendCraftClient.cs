using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SendCraft.Sdk;

public sealed class SendCraftClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private readonly string _apiKey;

    public SendCraftClient(string baseUrl, string? apiKey = null, HttpClient? httpClient = null)
    {
        _baseUrl = NormalizeBaseUrl(string.IsNullOrWhiteSpace(baseUrl) ? "https://api.sendcraft.net" : baseUrl);
        _apiKey = (apiKey ?? string.Empty).Trim();
        _httpClient = httpClient ?? new HttpClient();
    }

    public Task<JsonNode?> SendEmailAsync(object request, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Post, "/send-email", request, null, cancellationToken);

    public Task<JsonNode?> SendEmailWithPdfAsync(object request, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Post, "/send-email-with-pdf", request, null, cancellationToken);

    public Task<JsonNode?> GeneratePdfAsync(object request, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Post, "/generate-pdf", request, null, cancellationToken);

    public Task<JsonNode?> NotifyAsync(object request, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Post, "/notify", request, null, cancellationToken);

    public Task<JsonNode?> NotifyStatusAsync(string jobId, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Get, "/notify/" + Uri.EscapeDataString(jobId), null, null, cancellationToken);

    public Task<JsonNode?> ListProgramsAsync(Dictionary<string, object?>? query = null, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Get, "/automation-programs", null, query, cancellationToken);

    public Task<JsonNode?> CreateProgramAsync(object request, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Post, "/automation-programs", request, null, cancellationToken);

    public Task<JsonNode?> UpdateProgramAsync(string programId, object request, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Put, "/automation-programs/" + Uri.EscapeDataString(programId), request, null, cancellationToken);

    public Task<JsonNode?> DeleteProgramAsync(string programId, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Delete, "/automation-programs/" + Uri.EscapeDataString(programId), null, null, cancellationToken);

    public Task<JsonNode?> RunProgramAsync(string programId, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Post, "/automation-programs/" + Uri.EscapeDataString(programId) + "/run", null, null, cancellationToken);

    public Task<JsonNode?> LoadProgramQueueAsync(string programId, Dictionary<string, object?>? query = null, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Get, "/automation-programs/" + Uri.EscapeDataString(programId) + "/queue", null, query, cancellationToken);

    public Task<JsonNode?> EnqueueProgramQueueAsync(string programId, object request, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Post, "/automation-programs/" + Uri.EscapeDataString(programId) + "/queue", request, null, cancellationToken);

    public Task<JsonNode?> CancelProgramQueueItemAsync(string programId, string queueItemId, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Delete, "/automation-programs/" + Uri.EscapeDataString(programId) + "/queue/" + Uri.EscapeDataString(queueItemId), null, null, cancellationToken);

    public Task<JsonNode?> LoadMonitoringAsync(Dictionary<string, object?>? query = null, CancellationToken cancellationToken = default) =>
        SendAsync(HttpMethod.Get, "/automation-monitoring", null, query, cancellationToken);

    private async Task<JsonNode?> SendAsync(HttpMethod method, string path, object? body, Dictionary<string, object?>? query, CancellationToken cancellationToken)
    {
        var requestUri = BuildUri(path, query);
        using var request = new HttpRequestMessage(method, requestUri);

        if (!string.IsNullOrWhiteSpace(_apiKey))
        {
            request.Headers.TryAddWithoutValidation("x-api-key", _apiKey);
        }

        if (body is not null)
        {
            request.Content = new StringContent(JsonSerializer.Serialize(body, JsonOptions), Encoding.UTF8, "application/json");
        }

        using var response = await _httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        JsonNode? payload = string.IsNullOrWhiteSpace(raw) ? null : JsonNode.Parse(raw);

        if (!response.IsSuccessStatusCode || IsFailurePayload(payload))
        {
            throw new SendCraftException(BuildErrorMessage(payload, (int)response.StatusCode), (int)response.StatusCode, payload);
        }

        return payload;
    }

    private string BuildUri(string path, Dictionary<string, object?>? query)
    {
        var uri = CombineUrl(_baseUrl, path);
        if (query is null || query.Count == 0)
        {
            return uri;
        }

        var pairs = query
            .Where(item => item.Value is not null && item.Value?.ToString() != string.Empty)
            .Select(item => Uri.EscapeDataString(item.Key) + "=" + Uri.EscapeDataString(item.Value!.ToString()!));

        var queryString = string.Join("&", pairs);
        if (string.IsNullOrWhiteSpace(queryString))
        {
            return uri;
        }

        return uri + (uri.Contains("?") ? "&" : "?") + queryString;
    }

    private static string CombineUrl(string baseUrl, string path)
    {
        return baseUrl.TrimEnd('/') + "/" + path.TrimStart('/');
    }

    private static string NormalizeBaseUrl(string value)
    {
        var trimmed = (value ?? string.Empty).Trim().TrimEnd('/');
        return string.IsNullOrWhiteSpace(trimmed) ? "https://api.sendcraft.net" : trimmed;
    }

    private static bool IsFailurePayload(JsonNode? payload)
    {
        if (payload is null)
        {
            return false;
        }

        var successNode = payload["success"];
        if (successNode is JsonValue successValue && successValue.TryGetValue<bool>(out var success) && !success)
        {
            return true;
        }

        return payload["error"] is not null;
    }

    private static string BuildErrorMessage(JsonNode? payload, int statusCode)
    {
        if (payload is not null)
        {
            var error = payload["error"];
            if (error is JsonValue value && value.TryGetValue<string>(out var errorText) && !string.IsNullOrWhiteSpace(errorText))
            {
                return errorText;
            }

            var message = payload["message"]?.ToString();
            if (!string.IsNullOrWhiteSpace(message))
            {
                return message;
            }
        }

        return "Request failed (" + statusCode + ")";
    }
}