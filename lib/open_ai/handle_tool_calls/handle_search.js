const axios = require("axios");
const EVENT_NAMES = require("../../configs/event_names.js");
const logger = require("../../utils/logger.js");

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_MAX_RESULTS = Number(process.env.TAVILY_MAX_RESULTS || 2);
const TAVILY_SEARCH_DEPTH = process.env.TAVILY_SEARCH_DEPTH || "advanced";
const TAVILY_TIMEOUT_MS = Number(process.env.TAVILY_TIMEOUT_MS || 15000);
const TAVILY_RETRY_COUNT = Number(process.env.TAVILY_RETRY_COUNT || 1);
const MAX_ANSWER_CHARS = Number(process.env.TAVILY_MAX_ANSWER_CHARS || 240);
const MAX_SNIPPET_CHARS = Number(process.env.TAVILY_MAX_SNIPPET_CHARS || 160);

function truncateText(value, maxChars) {
  if (typeof value !== "string") return "";

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxChars) return normalized;

  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}

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
      const results = (data?.results || []).slice(0, TAVILY_MAX_RESULTS).map((r) => ({
        title: truncateText(r.title || "", 80),
        snippet: truncateText(r.content || "", MAX_SNIPPET_CHARS),
      }));

      return {
        query,
        answer: truncateText(data?.answer || "", MAX_ANSWER_CHARS) || null,
        results,
        instruction: "Answer directly in the user's language using answer first, then up to 2 brief result snippets. Do not ask a clarification question first.",
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

async function handleGoogleSearch(clientSocket, aiSocket, event, sendFunctionOutput) {
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
  clientSocket.emit(EVENT_NAMES.EMOTION,{"emotion": "search"});

  clientSocket.emit(EVENT_NAMES.SEARCH_STARTED, {
    tool: event.name,
    query: effectiveQuery,
  });

  try {
    const result = await runGoogleSearch(effectiveQuery);
    clientSocket.emit(EVENT_NAMES.EMOTION, {"emotion": "normal"});
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
    clientSocket.emit(EVENT_NAMES.EMOTION, {"emotion": "normal"});
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

module.exports = {
  handleGoogleSearch,
  runGoogleSearch,
};
