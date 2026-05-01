const EVENT_NAMES = require("../configs/event_names.js");
const { extractTranscriptText } = require("../utils/transcriptHandler.js");


function handleOpenAIEvent(clientSocket, event) {
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

    case "error":
      clientSocket.emit(EVENT_NAMES.SOCKET_ERROR, { error: event.error || event });
      break;
    default:
      clientSocket.emit("realtime.raw", event);
      break;
  }
}

module.exports = handleOpenAIEvent;
