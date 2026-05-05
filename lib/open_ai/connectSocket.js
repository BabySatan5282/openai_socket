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

const FACE_DEFAULT_BEHAVIOR_INSTRUCTIONS = `

## EMOTION TOOL USAGE POLICY
You have access to a tool called updateFace that controls the robot facial emotion display.
You MUST infer the emotional tone from the user's message content and context — not just from explicit statements like "I am happy".

### ALWAYS call updateFace BEFORE your response when the user's message carries clear emotional weight:
- **happy**: good news, achievements, exciting plans, winning, celebrations, jokes
- **sad**: loss, grief, disappointment, bad news, loneliness, health issues
- **angry**: complaints, frustration, unfair treatment, conflict
- **cry**: deep grief, heartbreak, tragedy
- **love**: expressing affection, talking about someone they care about
- **surprise**: unexpected news, shocking events
- **normal**: casual small talk, neutral questions, greetings

### RULES:
- Infer emotion from the **topic and context**, not just explicit words.
- Call updateFace even if the user does NOT say "I feel X" — judge by what happened to them.
- Call on every significant emotional turn, not just once per conversation.
- After calling updateFace, continue your response naturally without mentioning the tool.

### EXAMPLES:
- "I won the lottery" → happy (exciting event)
- "My dog died" → sad (loss)
- "My boss fired me for no reason" → angry (unfair situation)
- "I can't stop crying" → cry (deep distress)
- "I want to spend my life with her" → love (affection)
- "I just saw a ghost!" → surprise (shock)
- "What time is it?" → normal (neutral)
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
    instructions: `${baseInstructions}${NEWS_DEFAULT_BEHAVIOR_INSTRUCTIONS}${FACE_DEFAULT_BEHAVIOR_INSTRUCTIONS}`,
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
