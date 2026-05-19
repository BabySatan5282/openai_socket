const EVENT_NAMES = require("../../configs/event_names.js");
const logger = require("../../utils/logger.js");

function handleUpdateFace(clientSocket, aiSocket, event, sendFunctionOutput) {
  let args = {};
  try {
    args = event.arguments ? JSON.parse(event.arguments) : {};
  } catch {
    logger.error(clientSocket.id, "[getUserEmotion] Invalid arguments JSON.");
  }

  const emotion = typeof args.emotion === "string" ? args.emotion : "normal";

  clientSocket.emit(EVENT_NAMES.EMOTION, { emotion });
  logger.log(clientSocket.id, `[getUserEmotion] 😊 Emitted emotion: ${emotion}`);

  sendFunctionOutput(aiSocket, event.call_id, { ok: true, emotion });
}

module.exports = { handleUpdateFace };
