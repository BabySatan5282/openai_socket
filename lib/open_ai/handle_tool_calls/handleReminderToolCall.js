const logger = require("../../utils/logger.js");
const axios = require("axios");

const LARAVEL_API_BASE_URL = process.env.LARAVEL_API_BASE_URL;
const REMINDERS_PATH = process.env.LARAVEL_REMINDERS_PATH || "/reminders";
const REMINDERS_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 10000);

function buildReminderUrl() {
    const base = String(LARAVEL_API_BASE_URL || "").replace(/\/+$/, "");
    const rawPath = String(REMINDERS_PATH || "/reminders");
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

    // Prevent duplicated api version path if base already includes it.
    if (base.endsWith("/api/v1") && path.startsWith("/api/v1/")) {
        return `${base}${path.slice("/api/v1".length)}`;
    }

    return `${base}${path}`;
}

function buildErrorMessage(error) {
    if (error.code === "ECONNABORTED") {
        return `setReminder timed out after ${REMINDERS_TIMEOUT_MS}ms.`;
    }

    if (error.response?.status === 422) {
        const errors = error.response.data?.errors;
        if (errors && typeof errors === "object") {
            const firstKey = Object.keys(errors)[0];
            if (errors[firstKey]?.[0]) return errors[firstKey][0];
        }
    }

    return error.response?.data?.message || error.message || "Failed to set reminder.";
}

/**
 * Handles setReminder tool call from AI
 * @param {object} clientSocket
 * @param {object} aiSocket
 * @param {object} event
 * @param {function} sendFunctionOutput
 */
function handleReminderToolCall(clientSocket, aiSocket, event, sendFunctionOutput) {
    let args = {};
    try {
        args = event.arguments ? JSON.parse(event.arguments) : {};
    } catch {
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "Invalid function arguments JSON." });
        return;
    }

    logger.log(clientSocket.id, `⏰[setReminder] ${JSON.stringify(args)}`);

    if (!LARAVEL_API_BASE_URL) {
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "LARAVEL_API_BASE_URL is not configured." });
        return;
    }

    const token = clientSocket.user?.token;

    if (!token) {
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "User token is missing." });
        return;
    }


    // Validate required fields
    if (!args.task || !args.remind_at || !args.recurrence_type) {
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "Missing required fields: task, remind_at, recurrence_type" });
        return;
    }

    const payload = {
        task: String(args.task),
        remind_at: String(args.remind_at),
        recurrence_type: String(args.recurrence_type),
    };
    if (args.recurrence_meta !== undefined) {
        payload.recurrence_meta = args.recurrence_meta === null ? null : String(args.recurrence_meta);
    }

    axios
        .post(buildReminderUrl(), payload, {
            timeout: REMINDERS_TIMEOUT_MS,
            headers: {
                Authorization: token,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        })
        .then((res) => {
            sendFunctionOutput(aiSocket, event.call_id, { ok: true, data: res.data });
        })
        .catch((error) => {
            const msg = buildErrorMessage(error);
            sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: msg });
            logger.error(clientSocket.id, `[setReminder] ${msg}`);
        });
}

module.exports = handleReminderToolCall;
