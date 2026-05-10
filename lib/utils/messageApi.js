const axios = require("axios");
const logger = require("./logger.js");

const MESSAGES_URL = `${process.env.LARAVEL_API_BASE_URL}/messages`;
const TIMEOUT_MS = Number(process.env.LARAVEL_REQUEST_TIMEOUT_MS || 10000);

async function saveMessage(opts) {
  const payload = {
    sender_type: opts.senderType,
    message_body: opts.messageBody,
    origin_type: opts.originType,
    ...(opts.conversationId  && { conversation_id:   opts.conversationId }),
    ...(opts.assistantTypeId && { assistant_type_id: opts.assistantTypeId }),
    ...(opts.inputToken  != null && { input_token:  opts.inputToken }),
    ...(opts.outputToken != null && { output_token: opts.outputToken }),
    ...(opts.totalToken  != null && { total_token:  opts.totalToken }),
  };

  const response = await axios.post(MESSAGES_URL, payload, {
    headers: { Authorization: opts.token, Accept: "application/json", "Content-Type": "application/json" },
    timeout: TIMEOUT_MS,
  });

  return response.data?.data?.conversation_id ?? opts.conversationId;
}

// Fire-and-forget. Calls onSuccess(returnedId) on success.
function saveMessageAsync(socketId, opts, onSuccess) {
  saveMessage(opts)
    .then((returnedId) => onSuccess?.(returnedId))
    .catch((err) => {
      const status = err.response?.status;
      const detail = err.response?.data?.message || err.message;
      logger.error(socketId, `[MessageAPI] ${opts.senderType} save failed: ${status ? `HTTP ${status} — ` : ""}${detail}`);
    });
}

module.exports = { saveMessage, saveMessageAsync };

