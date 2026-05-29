const logger = require("../../utils/logger.js");
const axios = require("axios");

const LARAVEL_API_BASE_URL = process.env.LARAVEL_API_BASE_URL;
const EMAILS_PATH = "/connected-apps/gmail/latest-emails";
const EMAILS_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 10000);

function buildEmailsUrl() {
    const base = String(LARAVEL_API_BASE_URL || "").replace(/\/+$/, "");
    return `${base}${EMAILS_PATH}`;
}

function buildErrorMessage(error) {
    if (error.code === "ECONNABORTED") {
        return `checkEmail timed out after ${EMAILS_TIMEOUT_MS}ms.`;
    }
    return error.response?.data?.message || error.message || "Failed to check email.";
}

/**
 * Handles checkEmail tool call from AI
 * @param {object} clientSocket
 * @param {object} aiSocket
 * @param {object} event
 * @param {function} sendFunctionOutput
 */
async function handleCheckEmailToolCall(clientSocket, aiSocket, event, sendFunctionOutput) {
    logger.log(clientSocket.id, `📧 [checkEmail] tool called`);

    if (!LARAVEL_API_BASE_URL) {
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "LARAVEL_API_BASE_URL is not configured." });
        return;
    }

    const token = clientSocket.user?.token;
    if (!token) {
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "User token is missing." });
        return;
    }

    try {
        const res = await axios.get(buildEmailsUrl(), {
            timeout: EMAILS_TIMEOUT_MS,
            headers: {
                Authorization: token,
                Accept: "application/json",
            },
        });
        sendFunctionOutput(aiSocket, event.call_id, { ok: true, data: res.data });
    } catch (error) {
        const msg = buildErrorMessage(error);
        sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: msg });
        logger.error(clientSocket.id, `[checkEmail] ${msg}`);
    }
}

module.exports = { handleCheckEmailToolCall };
