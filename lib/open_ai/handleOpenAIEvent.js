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
      clientSocket.emit(EVENT_NAMES.CONVERSATION_CREATED, returnedId);
    }
  };

  const saveMsg = (extra) => {
    if (!extra.messageBody || extra.messageBody === "") return;
    return saveMessageAsync(clientSocket.id, {
      token: user.token,
      conversationId: user.conversationId,
      originType: user.type,
      assistantTypeId: user.assistantTypeId,
      ...extra,
    }, onSaved);
  };

  const BULKY_EVENTS = new Set([
    "response.audio.delta",
    "response.audio.done",
    "response.audio_transcript.delta",
    "response.output_audio.delta",
    "response.output_audio.done",
    "response.output_audio_transcript.delta",
    "conversation.item.input_audio_transcription.delta",
  ]);

  return function handleEvent(event) {
    if (BULKY_EVENTS.has(event.type)) {
      logger.log(clientSocket.id, `[Event] ** ${event.type} **`);
    } else {
      logger.log(clientSocket.id, `[Event] ${event.type}`, event);
    }

    if (event.type === "response.function_call_arguments.delta") return;

    if (event.type === "response.function_call_arguments.done") {
      handleFunctionCall(clientSocket, aiSocket, event).catch((err) =>
        logger.error(clientSocket.id, `[Function Call Error] ${err.message}`)
      );
      return;
    }

    switch (event.type) {
      case "response.audio.delta":
      case "response.output_audio.delta":
        clientSocket.emit(EVENT_NAMES.AI_AUDIO, Buffer.from(event.delta, "base64"));
        break;
      case "response.audio.done":
      case "response.output_audio.done":
        clientSocket.emit(EVENT_NAMES.AI_AUDIO_DONE);
        break;
      case "response.done":
        clientSocket.emit(EVENT_NAMES.AI_STREAM_DONE);
        if (!pendingAiTranscript) {
          const outputCount = Array.isArray(event.response?.output) ? event.response.output.length : 0;
          logger.log(
            clientSocket.id,
            `[Response Done Without Transcript] output_items=${outputCount}, status=${event.response?.status || "unknown"}`
          );
        }
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
      case "response.output_audio_transcript.delta":
        clientSocket.emit(EVENT_NAMES.OUTPUT_TRANSCRIPT, extractTranscriptText(event.delta));
        break;
      case "response.audio_transcript.done":
      case "response.output_audio_transcript.done": {
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
        break;
      case "rate_limits.updated": {
        const limits = Array.isArray(event.rate_limits) ? event.rate_limits : [];
        const compact = limits.map((item) => {
          const name = item.name || "unknown";
          const remaining = item.remaining ?? "?";
          const limit = item.limit ?? "?";
          const reset = item.reset_seconds ?? "?";
          return `${name}: remaining=${remaining}/${limit}, reset_s=${reset}`;
        });
        logger.log(clientSocket.id, `[Rate Limits Updated] ${compact.join(" | ") || "no data"}`);
        break;
      }
      case "error":
        logger.log(clientSocket.id, `[AI Error]`, event.error);
        clientSocket.emit(EVENT_NAMES.SOCKET_ERROR, { error: event.error || event });
        break;
      default:
       logger.log(clientSocket.id, `[Unhandled Event Type] ${event.type}`, event);
        break;
    }
  };
}

module.exports = createEventHandler;

