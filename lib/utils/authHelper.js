const axios = require("axios");
const { SocketUser } = require("../models/SocketUser");
const LARAVEL_API_BASE_URL = process.env.LARAVEL_API_BASE_URL;
const SOCKET_AUTH_PATH = process.env.LARAVEL_SOCKET_AUTH_PATH || "/socket/auth";
const AUTH_REQUEST_TIMEOUT_MS = Number(process.env.AUTH_REQUEST_TIMEOUT_MS || 10000);
const logger = require("./logger.js");

function sanitizeAuthPayload(auth = {}) {
    const payload = {};

    for (const [key, value] of Object.entries(auth)) {
        if (value !== "" && value !== null && value !== undefined) {
            payload[key] = value;
        }
    }

    return payload;
}

function validateAuthPayload(payload) {
    const hasToken = typeof payload.token === "string" && payload.token.trim() !== "";
    const hasDeviceAuth =
        typeof payload.mac_address === "string" &&
        payload.mac_address.trim() !== "" &&
        typeof payload.secret_key === "string" &&
        payload.secret_key.trim() !== "";

    if (!hasToken && !hasDeviceAuth) {
        throw new Error("Authentication requires token or mac_address + secret_key.");
    }
}

function maskPartial(value) {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (trimmed.length <= 4) return "*".repeat(trimmed.length);

    const start = trimmed.slice(0, 2);
    const end = trimmed.slice(-2);
    const middle = "*".repeat(trimmed.length - 4);
    return start + middle + end;
}

function maskSensitive(data = {}) {
    const masked = { ...data };

    if (masked.token) masked.token = maskPartial(masked.token);
    if (masked.secret_key) masked.secret_key = maskPartial(masked.secret_key);
    if (masked.secret) masked.secret = maskPartial(masked.secret);

    return masked;
}

function normalizeBoolean(value, fallback = true) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
    }

    return fallback;
}

async function authenticateClient(auth = {}) {

    if (!LARAVEL_API_BASE_URL) {
        throw new Error("LARAVEL_API_BASE_URL is not configured.");
    }
    logger.log("auth", "Authenticating client with payload: " + JSON.stringify(maskSensitive(auth)));
    const payload = sanitizeAuthPayload(auth);
    validateAuthPayload(payload);

    try {
        const response = await axios.post(
            `${LARAVEL_API_BASE_URL}${SOCKET_AUTH_PATH}`,
            payload,
            {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                timeout: AUTH_REQUEST_TIMEOUT_MS,
            }
        );

        const data = response.data?.data;

        if (!data?.user_id) {
            throw new Error("Invalid authentication response from Laravel API.");
        }

        const user = SocketUser.fromJson({
            ...data,
            get_greeting_msg: normalizeBoolean(payload.get_greeting_msg, true),
            connect_ai: normalizeBoolean(payload.connect_ai, true),
            mac_address: payload.mac_address ?? data?.mac_address,
        });

        return user;
    } catch (error) {
        if (error.code === "ECONNABORTED") {
            throw new Error("Authentication request timed out.");
        }

        if (error.response) {
            const message = error.response.data?.message || `Authentication failed with status ${error.response.status}.`;
            throw new Error(message);
        }

        throw error;
    }
}

module.exports = {
    authenticateClient,
};