const EVENT_NAMES = require("../configs/event_names.js");
const { extractTranscriptText } = require("../utils/transcriptHandler.js");
const logger = require("../utils/logger.js");
const { handleFunctionCall } = require("./handle_tool_calls/handle_tool_calls.js");
const { saveMessageAsync } = require("../utils/messageApi.js");

function createEventHandler(clientSocket, aiSocket, user) {
  let pendingAiTranscript = null;

  const onSaved = (returnedId) => {
    if (returnedId && returnedId !== user.conversationId) {
      user.conversationId = returnedId;
      clientSocket.emit(EVENT_NAMES.CONVERSATION_CREATED,  returnedId );
    }
  };

  const saveMsg = (extra) => saveMessageAsync(clientSocket.id, {
    token: user.token,
    conversationId: user.conversationId,
    originType: user.type,
    assistantTypeId: user.assistantTypeId,
    ...extra,
  }, onSaved);

  return function handleEvent(event) {
    if (event.type === "response.function_call_arguments.delta") return;

    if (event.type === "response.function_call_arguments.done") {
      handleFunctionCall(clientSocket, aiSocket, event).catch((err) =>
        logger.error(clientSocket.id, `[Function Call Error] ${err.message}`)
      );
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
        if (pendingAiTranscript) {
          const usage = event.response?.usage;
          saveMsg({
            senderType: "ai",
            messageBody: pendingAiTranscript,
            inputToken: usage?.input_tokens ?? 0,
            outputToken: usage?.output_tokens ?? 0,
            totalToken: usage?.total_tokens ?? 0,
          });
          pendingAiTranscript = null;
        }
        break;
      case "response.audio_transcript.delta":
        clientSocket.emit(EVENT_NAMES.OUTPUT_TRANSCRIPT, extractTranscriptText(event.delta));
        break;
      case "response.audio_transcript.done": {
        const aiTranscript = extractTranscriptText(event.transcript);
        logger.log(clientSocket.id, `[Audio Transcript Done] ${aiTranscript}`);
        clientSocket.emit("realtime.response.audio_transcript.done", aiTranscript);
        pendingAiTranscript = aiTranscript;
        break;
      }
      case "input_audio_buffer.speech_started":
        clientSocket.emit(EVENT_NAMES.SPEECH_STARTED);
        break;
      case "input_audio_buffer.speech_stopped":
        clientSocket.emit(EVENT_NAMES.SPEECH_STOPPED);
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const userTranscript = extractTranscriptText(event.transcript);
        logger.log(clientSocket.id, `[Input Audio Transcription Completed] ${userTranscript}`);
        clientSocket.emit(EVENT_NAMES.INPUT_TRANSCRIPT, userTranscript);
        saveMsg({ senderType: "user", messageBody: userTranscript });
        break;
      }
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
  };
}

module.exports = createEventHandler;

