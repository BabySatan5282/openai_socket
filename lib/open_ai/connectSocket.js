const OpenAIRealtimeClient = require("./openaiRealtimeClient.js");
const handleOpenAIEvent = require("./handleOpenAIEvent.js");
const handleClientEvents = require("./handleClientEvents.js");
const { createSleepManager } = require("./sleepManager.js");
const { OPENAI_REALTIME_CONFIG } = require("../configs/openai_config.js");
const logger = require("../utils/logger.js");
const EVENT_NAMES = require("../configs/event_names.js");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini";

function handleConnection(clientSocket) {
  logger.log(clientSocket.id, "[Socket.IO] Client connected");

  const aiSocket = new OpenAIRealtimeClient({
    apiKey: OPENAI_API_KEY,
    model: OPENAI_REALTIME_MODEL,
  });

  const sleepManager = createSleepManager({
    clientSocket,
    aiSocket,
  });

  aiSocket.on("event", (event) => {
    if (event.type === "response.done") {
      sleepManager.reset();
    }
    handleOpenAIEvent(clientSocket, aiSocket, event);
  });

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
    instructions: baseInstructions,
  };

  aiSocket
    .connect(sessionConfig)
    .then(() => {
      sleepManager.markAwake();
      clientSocket.emit(EVENT_NAMES.AI_READY, { model: OPENAI_REALTIME_MODEL });
      sleepManager.reset();
    })
    .catch((err) => {
      logger.error(clientSocket.id, `[OpenAI SDK] Failed to connect: ${err.message}`);
      clientSocket.emit(EVENT_NAMES.AI_ERROR, {
        error:
          err.message ||
          "Failed to connect to AI",
      });
    });

  handleClientEvents(clientSocket, aiSocket, {
    onWakeUp: async () => {
      await sleepManager.wakeUp({
        connect: async () => {
          await aiSocket.connect(sessionConfig);
        },
        onReady: () => {
          clientSocket.emit(EVENT_NAMES.AI_READY, { model: OPENAI_REALTIME_MODEL });
        },
      });
    },
    onDisconnectCleanup: () => {
      sleepManager.clear();
    },
  });
}

module.exports = handleConnection;
