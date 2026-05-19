
const { googleSearch, userEmotion, saveUserFacts, reminderTool, currentTimeTool } = require("./tools");

const OPENAI_REALTIME_CONFIG = {
  type: "realtime",
  instructions: "You are a helpful AI assistant...",
  output_modalities: ["audio"],
  audio: {
    input: {
      format: { type: "audio/pcm", rate: 24000 },
      transcription: { model: "whisper-1" },
      turn_detection: {
        type: "server_vad",
        threshold: 0.7,
        prefix_padding_ms: 300,
        silence_duration_ms: 1200,
      },
    },
    output: {
      format: { type: "audio/pcm", rate: 24000 },
      voice: "cedar",
    },
  },
  tools: [googleSearch, userEmotion, saveUserFacts, reminderTool, currentTimeTool],
  tool_choice: "auto",
};

module.exports = {
  OPENAI_REALTIME_CONFIG,
};
