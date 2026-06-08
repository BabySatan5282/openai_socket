const logger = require("../../utils/logger.js");
const axios = require("axios");

const LARAVEL_API_BASE_URL = process.env.LARAVEL_API_BASE_URL;
const DRAFT_REPLY_PATH = "/connected-apps/gmail/draft-reply";
const DRAFT_REPLY_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 10000);

function buildDraftReplyUrl() {
    const base = String(LARAVEL_API_BASE_URL || "").replace(/\/+$/, "");
    return `${base}${DRAFT_REPLY_PATH}`;
}

function buildErrorMessage(error) {
    if (error.code === "ECONNABORTED") {
        return `draftEmailReply timed out after ${DRAFT_REPLY_TIMEOUT_MS}ms.`;
    }
    return error.response?.data?.message || error.message || "Failed to save draft reply.";
}

/**
 * Handles draft_email_reply tool call from AI.
 * @param {object} clientSocket
 * @param {object} aiSocket
 * @param {object} event
 * @param {function} sendFunctionOutput
 */
async function handleDraftReplyToolCall(clientSocket, aiSocket, event, sendFunctionOutput) {
    logger.log(clientSocket.id, `✉️ [draftEmailReply] tool called`);

    if (!LARAVEL_API_BASE_URL) {
        logger.error(clientSocket.id, `[draftEmailReply] LARAVEL_API_BASE_URL is not configured.`);
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "LARAVEL_API_BASE_URL is not configured." });
        return;
    }

    const token = clientSocket.user?.token;
    if (!token) {
        logger.error(clientSocket.id, `[draftEmailReply] User token is missing.`);
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "User token is missing." });
        return;
    }

    let args;
    try {
        args = typeof event.arguments === "string" ? JSON.parse(event.arguments) : event.arguments;
        logger.log(clientSocket.id, `[draftEmailReply] parsed args: message_id=${args?.message_id}, body_length=${args?.body?.length ?? 0}`);
    } catch {
        logger.error(clientSocket.id, `[draftEmailReply] Failed to parse arguments: ${event.arguments}`);
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "Invalid arguments." });
        return;
    }

    const { message_id, body } = args || {};
    if (!message_id || !body) {
        logger.error(clientSocket.id, `[draftEmailReply] Missing required fields — message_id: ${message_id}, body: ${body}`);
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "message_id and body are required." });
        return;
    }

    const url = buildDraftReplyUrl();
    logger.log(clientSocket.id, `[draftEmailReply] POST ${url} — message_id: ${message_id}`);

    try {
        const res = await axios.post(
            url,
            { message_id, body },
            {
                timeout: DRAFT_REPLY_TIMEOUT_MS,
                headers: {
                    Authorization: token,
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
            }
        );

        logger.log(clientSocket.id, `[draftEmailReply] ✅ Draft saved — draft_id: ${res.data?.data?.draft_id}, thread_id: ${res.data?.data?.thread_id}`);
        sendFunctionOutput(aiSocket, event.call_id, { ok: true, data: res.data });
    } catch (error) {
        const msg = buildErrorMessage(error);
        logger.error(clientSocket.id, `[draftEmailReply] ❌ Failed — ${msg}`);
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: msg });
    }
}

module.exports = { handleDraftReplyToolCall };
