const EVENT_NAMES = require("../configs/event_names.js");
const { extractTranscriptText } = require("../utils/transcriptHandler.js");
const logger = require("../utils/logger.js");
const { handleFunctionCall } = require("./handle_tool_calls/handle_tool_calls.js");
const { json } = require("express");


function handleOpenAIEvent(clientSocket, aiSocket, event) {
  // log the whole event
  // const sanitized = JSON.stringify(event, (key, value) =>
  //   typeof value === "string" && value.length > 200 ? `[BASE64_DATA ~${value.length}chars]` : value
  // );
  // logger.log(`[OpenAI Event] ${event.type} | ${sanitized}`);

  if (event.type === "response.function_call_arguments.done") {
    handleFunctionCall(clientSocket, aiSocket, event).catch((error) => {
      logger.error(clientSocket.id, `[Function Call Error] ${error.message}`);
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

    case "error":
      clientSocket.emit(EVENT_NAMES.SOCKET_ERROR, { error: event.error || event });
      break;
    default:
      logger.log("Unhandled OpenAI event type:", event.type);
      clientSocket.emit("realtime.raw", event);
      break;
  }
}

module.exports = handleOpenAIEvent;
