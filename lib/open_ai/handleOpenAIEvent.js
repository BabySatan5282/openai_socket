const axios = require("axios");
const EVENT_NAMES = require("../configs/event_names.js");
const { extractTranscriptText } = require("../utils/transcriptHandler.js");
const logger = require("../utils/logger.js");

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_MAX_RESULTS = Number(process.env.TAVILY_MAX_RESULTS || 5);
const TAVILY_SEARCH_DEPTH = process.env.TAVILY_SEARCH_DEPTH || "advanced";
const TAVILY_TIMEOUT_MS = Number(process.env.TAVILY_TIMEOUT_MS || 15000);
const TAVILY_RETRY_COUNT = Number(process.env.TAVILY_RETRY_COUNT || 1);

function buildSearchError(error, query, attempt) {
  const status = error.response?.status;
  const providerMessage = error.response?.data?.message;
  const isTimeout = error.code === "ECONNABORTED";
  const message = isTimeout
    ? `Tavily request timed out after ${TAVILY_TIMEOUT_MS}ms.`
    : providerMessage || error.message || "Tavily request failed.";

  return {
    message,
    code: error.code || null,
    status: status ?? null,
    query,
    attempt,
    retryable: isTimeout || status === 429 || (status >= 500 && status < 600),
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGoogleSearch(query) {
  logger.log("🌐 Running web search for query:", query);

  if (!TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured.");
  }

  const maxAttempts = Math.max(1, TAVILY_RETRY_COUNT + 1);
  let searchError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.post("https://api.tavily.com/search", {
        api_key: TAVILY_API_KEY,
        query,
        search_depth: TAVILY_SEARCH_DEPTH,
        include_answer: true,
        include_raw_content: false,
        max_results: TAVILY_MAX_RESULTS,
        include_images: false,
      }, {
        timeout: TAVILY_TIMEOUT_MS,
        headers: { "Content-Type": "application/json" },
      });

      const data = response.data;
      const results = (data?.results || []).map((r) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.content || "",
        score: r.score ?? null,
        published_date: r.published_date || null,
      }));

      return {
        query,
        answer: data?.answer || null,
        results,
        instruction: [
          "Answer the user's question directly and informatively using the data above.",
          "If 'answer' is present, use it as the foundation of your response.",
          "Supplement with relevant details from 'results' (title, snippet, source).",
          "Respond in the same language the user spoke.",
          "Do NOT ask a clarification question before giving your answer.",
        ].join(" "),
      };
    } catch (error) {
      searchError = buildSearchError(error, query, attempt);
      logger.error(
        "🌐❌ Web search failed:",
        JSON.stringify(searchError)
      );

      if (!searchError.retryable || attempt === maxAttempts) {
        break;
      }

      logger.log(
        `🌐♻️ Retrying web search for query: ${query} (attempt ${attempt + 1}/${maxAttempts})`
      );
      await wait(300 * attempt);
    }
  }

  throw new Error(searchError?.message || "Tavily request failed.");
}

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

  if (event.name !== "google_search") {
    sendFunctionOutput(aiSocket, event.call_id, {
      ok: false,
      error: `Unsupported function: ${event.name || "unknown"}`,
    });
    return;
  }

  let args = {};
  try {
    args = event.arguments ? JSON.parse(event.arguments) : {};
  } catch {
    sendFunctionOutput(aiSocket, event.call_id, {
      ok: false,
      error: "Invalid function arguments JSON.",
    });
    return;
  }

  const query = typeof args.query === "string" ? args.query.trim() : "";
  const effectiveQuery = query || "latest global headlines today";

  clientSocket.emit(EVENT_NAMES.SEARCH_STARTED, {
    tool: event.name,
    query: effectiveQuery,
  });

  try {
    const result = await runGoogleSearch(effectiveQuery);
    clientSocket.emit(EVENT_NAMES.SEARCH_COMPLETED, {
      tool: event.name,
      query: effectiveQuery,
      provider: "tavily",
      resultCount: result.results.length,
    });

    sendFunctionOutput(aiSocket, event.call_id, {
      ok: true,
      provider: "tavily",
      query_used: effectiveQuery,
      answer_style: "Return direct latest-news summary first. Do not ask clarification before giving headlines.",
      result,
    });
  } catch (error) {
    clientSocket.emit(EVENT_NAMES.SEARCH_FAILED, {
      tool: event.name,
      query: effectiveQuery,
      error: error?.message || "Search failed.",
    });

    sendFunctionOutput(aiSocket, event.call_id, {
      ok: false,
      error: error?.message || "Search failed.",
    });
  }
}

function handleOpenAIEvent(clientSocket, aiSocket, event) {
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
      clientSocket.emit("realtime.raw", event);
      break;
  }
}

module.exports = handleOpenAIEvent;
