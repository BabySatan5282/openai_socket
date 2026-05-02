const OpenAIRealtimeClient = require("./openaiRealtimeClient.js");
const handleOpenAIEvent = require("./handleOpenAIEvent.js");
const handleClientEvents = require("./handleClientEvents.js");
const { OPENAI_REALTIME_CONFIG } = require("../configs/openai_config.js");
const logger = require("../utils/logger.js");
const EVENT_NAMES = require("../configs/event_names.js");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini";

const NEWS_DEFAULT_BEHAVIOR_INSTRUCTIONS = `

## NEWS QUERY EXECUTION POLICY
- If user asks for latest news (for example: "latest news", "tell me news", "today news"), do not ask clarification first.
- Immediately call google_search with a best-effort query and provide a concise answer.
- If topic is missing, default to: "latest global headlines today".
- If user asks topic-only (for example: "political news"), default to: "latest <topic> news today in Myanmar and world".
- Ask follow-up questions only after giving an initial answer.
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
