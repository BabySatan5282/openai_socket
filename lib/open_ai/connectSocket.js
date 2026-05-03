const OpenAIRealtimeClient = require("./openaiRealtimeClient.js");
const handleOpenAIEvent = require("./handleOpenAIEvent.js");
const handleClientEvents = require("./handleClientEvents.js");
const { OPENAI_REALTIME_CONFIG } = require("../configs/openai_config.js");
const logger = require("../utils/logger.js");
const EVENT_NAMES = require("../configs/event_names.js");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini";

const NEWS_DEFAULT_BEHAVIOR_INSTRUCTIONS = `

## SEARCH TOOL USAGE POLICY
You have access to a real-time web search tool called google_search. Use it proactively for any query that benefits from current or factual information.

### WHEN TO CALL google_search (call immediately, no clarification first):
- News & current events: "latest news", "what happened today", "recent updates on X"
- Facts & data: prices, statistics, scores, weather, population, rankings
- How-to & explanations: "how does X work", "what is X", "explain X"
- People, places, companies: background info, recent activity
- Any question where your training data may be outdated

### HOW TO ANSWER:
- Use the "answer" field from search results as the core of your response if available.
- Enrich with key details from "results" (snippets, sources, dates).
- Respond in the same language the user spoke.
- Be direct and informative — give the answer first, then supporting details.
- Mention source names naturally (e.g. "According to BBC...").
- Do NOT ask clarifying questions before giving an answer. Search first, answer, then optionally ask if they want more detail.

### DEFAULT QUERIES (if user is vague):
- "latest news" → search "top world headlines today"
- "political news" → search "latest political news today"
- "weather" → search "weather forecast today" (use user location if known)
`;

function handleConnection(clientSocket) {
  logger.log(clientSocket.id, "[Socket.IO] Client connected");
  
  const aiSocket = new OpenAIRealtimeClient({
    apiKey: OPENAI_API_KEY,
    model: OPENAI_REALTIME_MODEL,
  });

  aiSocket.on("event", (event) => handleOpenAIEvent(clientSocket, aiSocket, event));

  aiSocket.on("error", (err) => {
    logger.error(clientSocket.id, `[OpenAI SDK] Realtime error: ${err.message}`);
    clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message });
  });

  aiSocket.on("close", ({ code, reason }) => {
    logger.log(clientSocket.id, `[OpenAI SDK] Realtime closed. Code: ${code}. Reason: ${reason}`);
  });

  const user = clientSocket.user;
  const baseInstructions = user?.system_prompt || OPENAI_REALTIME_CONFIG.instructions || "";
  const sessionConfig = {
    ...OPENAI_REALTIME_CONFIG,
    instructions: `${baseInstructions}${NEWS_DEFAULT_BEHAVIOR_INSTRUCTIONS}`,
  };

  aiSocket
    .connect(sessionConfig)
    .then(() => {
      clientSocket.emit(EVENT_NAMES.AI_READY, { model: OPENAI_REALTIME_MODEL });
    })
    .catch((err) => {
      logger.error(clientSocket.id, `[OpenAI SDK] Failed to connect: ${err.message}`);
      clientSocket.emit(EVENT_NAMES.AI_ERROR, {
        error:
          err.message ||
          "Failed to connect to AI",
      });
    });

  handleClientEvents(clientSocket, aiSocket);
}

module.exports = handleConnection;
