const OpenAIRealtimeClient = require("./openaiRealtimeClient.js");
const createEventHandler = require("./handleOpenAIEvent.js");
const handleClientEvents = require("./handleClientEvents.js");
const { createSleepManager } = require("./sleepManager.js");
const { OPENAI_REALTIME_CONFIG } = require("../configs/openai_config.js");
const logger = require("../utils/logger.js");
const EVENT_NAMES = require("../configs/event_names.js");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini";
const INITIAL_GREETING_PROMPT =
  "Start with a warm greeting and ask how their heart or day is feeling. Keep it natural and avoid repeating the same phrase.";

function sendInitialGreeting(aiSocket, clientSocket) {
  try {
    logger.log(clientSocket.id, "👋 [Initial Greeting] Sending initial greeting to AI");
    aiSocket.sendEvent({
      type: "response.create",
      response: {
        instructions: INITIAL_GREETING_PROMPT,
      },
    });
  } catch (err) {
    logger.error(clientSocket.id, `[OpenAI SDK] Failed to send initial greeting: ${err.message}`);
  }
}

function handleConnection(clientSocket) {
  logger.log(clientSocket.id, "[Socket.IO] Client connected");

  const user = clientSocket.user;
  const baseInstructions = user?.systemPrompt || OPENAI_REALTIME_CONFIG.instructions || "";
  const sessionConfig = { ...OPENAI_REALTIME_CONFIG, instructions: baseInstructions };

  const aiSocket = new OpenAIRealtimeClient({ apiKey: OPENAI_API_KEY, model: OPENAI_REALTIME_MODEL });
  const sleepManager = createSleepManager({ clientSocket, aiSocket });
  const handleEvent = createEventHandler(clientSocket, aiSocket, user);

  const connectWithoutGreeting = async () => {
    await sleepManager.wakeUp({
      connect: async () => {
        await aiSocket.connect(sessionConfig);
      },
      onReady: () => {
        clientSocket.emit(EVENT_NAMES.AI_READY, { model: OPENAI_REALTIME_MODEL });
      },
    });
  };

  const sendReminderTaskToAi = ({ task }) => {
    if (!aiSocket.isReady) {
      throw new Error("AI session is not ready.");
    }

    logger.log(clientSocket.id, ` ⏰[Reminder Task] Sending reminder task to AI: ${task}`);

    aiSocket.sendEvent({
      type: "response.create",
      response: {
        tool_choice: "none",
        instructions: `Give a gentle and caring reminder. The first sentence must clearly mention the task: ${task}. Use a warm, supportive tone (not commanding), like a friendly nudge. Keep it brief, do not ask follow-up questions, do not mention current time, and do not call any tool.`,
      },
    });
  };

  clientSocket.aiBridge = {
    isAiReady: () => aiSocket.isReady,
    isSleeping: () => sleepManager.isAsleep(),
    wakeAiWithoutGreeting: connectWithoutGreeting,
    sendReminderTaskToAi,
  };

  aiSocket.on("event", (event) => {
    if (event.type === "response.done") sleepManager.reset();
    handleEvent(event);
  });

  aiSocket.on("error", (err) => {
    logger.error(clientSocket.id, `[OpenAI SDK] Realtime error: ${err.message}`);
    clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message });
  });

  aiSocket.on("close", ({ code, reason }) => {
    logger.log(clientSocket.id, `[OpenAI SDK] Realtime closed. Code: ${code}. Reason: ${reason}`);
  });

  logger.log(clientSocket.id, `[Session Config] tools=${JSON.stringify((sessionConfig.tools || []).map(t => t.name))}, instructions_length=${baseInstructions.length}`);

  aiSocket
    .connect(sessionConfig)
    .then(() => {
      sleepManager.markAwake();
      clientSocket.emit(EVENT_NAMES.AI_READY, { model: OPENAI_REALTIME_MODEL });
      sleepManager.reset();
      sendInitialGreeting(aiSocket, clientSocket);
    })
    .catch((err) => {
      logger.error(clientSocket.id, `[OpenAI SDK] Failed to connect: ${err.message}`);
      clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message || "Failed to connect to AI" });
    });

  handleClientEvents(clientSocket, aiSocket, {
    onWakeUp: async () => {
      await sleepManager.wakeUp({
        connect: async () => { await aiSocket.connect(sessionConfig); },
        onReady: () => { clientSocket.emit(EVENT_NAMES.AI_READY, { model: OPENAI_REALTIME_MODEL }); },
      });
      sendInitialGreeting(aiSocket, clientSocket);
    },
    onDisconnectCleanup: () => { sleepManager.clear(); },
  });
}

module.exports = handleConnection;
