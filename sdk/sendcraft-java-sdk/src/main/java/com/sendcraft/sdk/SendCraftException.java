package com.sendcraft.sdk;

import com.fasterxml.jackson.databind.JsonNode;

public class SendCraftException extends RuntimeException {
    private final int statusCode;
    private final JsonNode payload;

    public SendCraftException(String message, int statusCode, JsonNode payload) {
        super(message);
        this.statusCode = statusCode;
        this.payload = payload;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public JsonNode getPayload() {
        return payload;
    }
}