const EVENT_NAMES = require("../configs/event_names.js");
const { extractTranscriptText } = require("../utils/transcriptHandler.js");
const logger = require("../utils/logger.js");

function decodeXmlEntities(text = "") {
  return text
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return decodeXmlEntities(match?.[1] || "");
}

function parseRssItems(xml, limit = 8) {
  const items = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of matches) {
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate");
    const description = extractTag(itemXml, "description");
    const source = extractTag(itemXml, "source") || "unknown";

    if (!title || !link) continue;

    items.push({
      title,
      link,
      source,
      pub_date: pubDate || null,
      snippet: description || null,
    });

    if (items.length >= limit) break;
  }

  return items;
}

async function fetchRssHeadlines(url, limit = 8) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "User-Agent": "openai-socket-news-bot/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`RSS request failed (${response.status}) for ${url}`);
  }

  const xml = await response.text();
  return parseRssItems(xml, limit);
}

async function runGoogleSearch(query) {
  logger.log("Running web search for query:", query);
  const encodedQuery = encodeURIComponent(query);
  const sources = [
    {
      provider: "google_news_rss",
      url: `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`,
    },
    {
      provider: "bing_news_rss",
      url: `https://www.bing.com/news/search?q=${encodedQuery}&format=rss`,
    },
  ];

  const attempts = [];
  const headlines = [];

  for (const source of sources) {
    try {
      const rows = await fetchRssHeadlines(source.url, 8);
      if (rows.length > 0) {
        for (const row of rows) {
          headlines.push({
            ...row,
            provider: source.provider,
          });
          if (headlines.length >= 10) break;
        }
      }

      attempts.push({
        provider: source.provider,
        ok: true,
        count: rows.length,
      });
    } catch (error) {
      attempts.push({
        provider: source.provider,
        ok: false,
        error: error?.message || "unknown error",
      });
    }

    if (headlines.length >= 5) break;
  }

  if (headlines.length === 0) {
    throw new Error(`No headlines found for query: ${query}`);
  }

  return {
    query,
    total: headlines.length,
    attempts,
    headlines,
    instruction:
      "Use these headlines to answer directly in 3-5 concise bullets, include source names, and do not ask a clarification question first.",
  };
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

  try {
    const result = await runGoogleSearch(effectiveQuery);
    sendFunctionOutput(aiSocket, event.call_id, {
      ok: true,
      provider: "google_news_rss_fallback_bing_news_rss",
      query_used: effectiveQuery,
      answer_style: "Return direct latest-news summary first. Do not ask clarification before giving headlines.",
      result,
    });
  } catch (error) {
    sendFunctionOutput(aiSocket, event.call_id, {
      ok: false,
      error: error?.message || "Search failed.",
    });
  }
}

function handleOpenAIEvent(clientSocket, aiSocket, event) {
  if (event.type === "response.function_call_arguments.done") {
    void handleFunctionCall(clientSocket, aiSocket, event);
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
