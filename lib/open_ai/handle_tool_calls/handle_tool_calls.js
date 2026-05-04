const EVENT_NAMES = require("../../configs/event_names.js");
const logger = require("../../utils/logger.js");
const { handleGoogleSearch } = require("./handle_search.js");

function sendFunctionOutput(aiSocket, callId, payload) {
  if (!callId) return;

  aiSocket.sendEvent({
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(payload),
    },
  });

  aiSocket.sendEvent({
    type: "response.create",
  });
}

async function handleFunctionCall(clientSocket, aiSocket, event) {
  if (event.type !== "response.function_call_arguments.done") return;

  if (event.name === "google_search") {
    await handleGoogleSearch(clientSocket, aiSocket, event, sendFunctionOutput);
    return;
  }

  sendFunctionOutput(aiSocket, event.call_id, {
    ok: false,
    error: `Unsupported function: ${event.name || "unknown"}`,
  });
}

module.exports = {
  handleFunctionCall,
};
