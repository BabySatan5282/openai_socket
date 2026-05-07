const axios = require("axios");
const logger = require("../../utils/logger.js");

const LARAVEL_API_BASE_URL = process.env.LARAVEL_API_BASE_URL;
const USER_FACTS_PATH = process.env.LARAVEL_USER_FACTS_PATH || "/socket/user-facts";
const USER_FACTS_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 10000);

const HIGH_IMPORTANCE_CATEGORIES = new Set([
  "identity", "profile", "medical", "health", "allergy",
  "emergency", "family", "relationship", "finance", "goal",
]);

function inferImportanceScore(category) {
  const cat = typeof category === "string" ? category.trim().toLowerCase() : "";
  return HIGH_IMPORTANCE_CATEGORIES.has(cat) ? 8 : 5;
}

function buildPayload(args) {
  return {
    action: "add",
    fact: String(args.fact || "").trim(),
    ...(args.category != null && { category: String(args.category).trim() }),
    importance_score: args.importance_score != null
      ? args.importance_score
      : inferImportanceScore(args.category),
  };
}

function buildErrorMessage(error) {
  if (error.code === "ECONNABORTED") {
    return `saveUserFacts timed out after ${USER_FACTS_TIMEOUT_MS}ms.`;
  }

  if (error.response?.status === 422) {
    const errors = error.response.data?.errors;
    if (errors && typeof errors === "object") {
      const firstKey = Object.keys(errors)[0];
      if (errors[firstKey]?.[0]) return errors[firstKey][0];
    }
  }

  return error.response?.data?.message || error.message || "Failed to save user fact.";
}

function handleSaveUserFacts(clientSocket, aiSocket, event, sendFunctionOutput) {
  let args = {};
  try {
    args = event.arguments ? JSON.parse(event.arguments) : {};
  } catch {
    sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "Invalid function arguments JSON." });
    return;
  }

  logger.log(clientSocket.id, `💾[saveUserFacts] ${JSON.stringify(args)}`);

  if (!LARAVEL_API_BASE_URL) {
    sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "LARAVEL_API_BASE_URL is not configured." });
    return;
  }

  const payload = buildPayload(args);

  axios.post(
    `${LARAVEL_API_BASE_URL}${USER_FACTS_PATH}`,
    payload,
    {
      timeout: USER_FACTS_TIMEOUT_MS,
      headers: {
        Authorization: clientSocket.user.token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  ).catch((error) => {
    logger.error(clientSocket.id, `[saveUserFacts] ${buildErrorMessage(error)}`);
  });

  sendFunctionOutput(aiSocket, event.call_id, { ok: true, action_used: payload.action });
}

module.exports = { handleSaveUserFacts };
