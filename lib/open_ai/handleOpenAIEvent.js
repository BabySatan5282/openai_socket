const EVENT_NAMES = require("../configs/event_names.js");
const { extractTranscriptText } = require("../utils/transcriptHandler.js");
const logger = require("../utils/logger.js");
const { handleFunctionCall } = require("./handle_tool_calls/handle_tool_calls.js");

// function isBase64Like(value) {
//   return typeof value === "string" && value.length > 40 && /^[A-Za-z0-9+/=]+$/.test(value);
// }

// function sanitizeForLog(value, key = "") {
//   if (typeof value === "string") {
//     const lowerKey = key.toLowerCase();
//     if (lowerKey.includes("audio") || lowerKey.includes("delta") || isBase64Like(value)) {
//       return "[BASE64_REDACTED]";
//     }
//     return value;
//   }

//   if (Array.isArray(value)) {
//     return value.map((item) => sanitizeForLog(item, key));
//   }

//   if (value && typeof value === "object") {
//     const output = {};
//     for (const [childKey, childValue] of Object.entries(value)) {
//       output[childKey] = sanitizeForLog(childValue, childKey);
//     }
//     return output;
//   }

//   return value;
// }

function handleOpenAIEvent(clientSocket, aiSocket, event) {
  // logger.log(clientSocket.id, `[OpenAI EVENT] ${JSON.stringify(sanitizeForLog(event))}`);

  if (event.type === "response.function_call_arguments.delta") {
    return;
  }

  if (event.type === "response.function_call_arguments.done") {
    handleFunctionCall(clientSocket, aiSocket, event).catch((err) => {
      logger.error(clientSocket.id, `[Function Call Error] ${err.message}`);
    });
    return;
  }

  switch (event.type) {
    case "response.audio.delta":
      clientSocket.emit(EVENT_NAMES.AI_AUDIO, { data: event.delta });
      break;
    case "response.audio.done":
      clientSocket.emit(EVENT_NAMES.AI_AUDIO_DONE);
      break;
    case "response.done":
      clientSocket.emit(EVENT_NAMES.AI_STREAM_DONE, event);
      break;
    case "response.audio_transcript.delta":
      clientSocket.emit(EVENT_NAMES.OUTPUT_TRANSCRIPT, extractTranscriptText(event.delta));
      break;
    case "response.audio_transcript.done":
      clientSocket.emit("realtime.response.audio_transcript.done", extractTranscriptText(event.transcript));
      break;
    case "input_audio_buffer.speech_started":
      clientSocket.emit(EVENT_NAMES.SPEECH_STARTED);
      break;
    case "input_audio_buffer.speech_stopped":
      clientSocket.emit(EVENT_NAMES.SPEECH_STOPPED);
      break;
    case "conversation.item.input_audio_transcription.completed":
      clientSocket.emit(EVENT_NAMES.INPUT_TRANSCRIPT, extractTranscriptText(event.transcript));
      break;

    case "session.updated":
    case "session.created":
    case "input_audio_buffer.committed":
    case "conversation.item.created":
    case "response.created":
    case "response.output_item.added":
    case "response.content_part.added":
    case "response.content_part.done":
    case "response.output_item.done":
    case "conversation.item.input_audio_transcription.delta":
    case "rate_limits.updated":
      break;

    case "error":
      clientSocket.emit(EVENT_NAMES.SOCKET_ERROR, { error: event.error || event });
      break;
    default:
      clientSocket.emit("realtime.raw", event);
      break;
  }
}

module.exports = handleOpenAIEvent;
