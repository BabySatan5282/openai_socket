const EVENT_NAMES = require("../configs/event_names.js");
const { extractTranscriptText } = require("../utils/transcriptHandler.js");
const logger = require("../utils/logger.js");
const { handleFunctionCall } = require("./handle_tool_calls/handle_tool_calls.js");

function handleOpenAIEvent(clientSocket, aiSocket, event) {
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
      logger.log("Final transcript received:", event.transcript);
      clientSocket.emit("realtime.response.audio_transcript.done", extractTranscriptText(event.transcript));
      break;
    case "input_audio_buffer.speech_started":
      clientSocket.emit(EVENT_NAMES.SPEECH_STARTED);
      break;
    case "input_audio_buffer.speech_stopped":
      clientSocket.emit(EVENT_NAMES.SPEECH_STOPPED);
      break;
    case "conversation.item.input_audio_transcription.completed":
      logger.log("Input audio transcription completed:", event.transcript);
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
      // logger.log("Unhandled OpenAI event type:", event.type);
      clientSocket.emit("realtime.raw", event);
      break;
  }
}

module.exports = handleOpenAIEvent;
