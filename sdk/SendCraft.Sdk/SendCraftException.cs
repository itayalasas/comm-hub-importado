using System.Text.Json.Nodes;

namespace SendCraft.Sdk;

public sealed class SendCraftException : Exception
{
    public int StatusCode { get; }
    public JsonNode? Payload { get; }

    public SendCraftException(string message, int statusCode, JsonNode? payload = null)
        : base(message)
    {
        StatusCode = statusCode;
        Payload = payload;
    }
}