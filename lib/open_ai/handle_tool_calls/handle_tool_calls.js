
const logger = require("../../utils/logger.js");
const { handleGoogleSearch } = require("./handle_search.js");
const { handleUpdateFace } = require("./handle_update_face.js");
const { handleSaveUserFacts } = require("./handle_save_user_facts.js");
const handleReminderToolCall = require("./handleReminderToolCall.js");
const { handleCurrentTimeToolCall } = require("./handle_current_time.js");

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

  aiSocket.sendEvent({ type: "response.create" });
}

async function handleFunctionCall(clientSocket, aiSocket, event) {
  if (event.type !== "response.function_call_arguments.done") return;

  logger.log(clientSocket.id, `[Function Call] ${event.name || "unknown"}`);


  if (event.name === "google_search") {
    await handleGoogleSearch(clientSocket, aiSocket, event, sendFunctionOutput);
    return;
  }

  if (event.name === "getUserEmotion") {
    handleUpdateFace(clientSocket, aiSocket, event, sendFunctionOutput);
    return;
  }

  if (event.name === "saveUserFacts") {
    handleSaveUserFacts(clientSocket, aiSocket, event, sendFunctionOutput);
    return;
  }

  if (event.name === "setReminder") {
    handleReminderToolCall(clientSocket, aiSocket, event, sendFunctionOutput);
    return;
  }

  if (event.name === "getCurrentTime") {
    handleCurrentTimeToolCall(clientSocket, aiSocket, event, sendFunctionOutput);
    return;
  }

  sendFunctionOutput(aiSocket, event.call_id, {
    ok: false,
    error: `Unsupported function: ${event.name || "unknown"}`,
  });
}

module.exports = { handleFunctionCall };
