
const { googleSearch, userEmotion, saveUserFacts, reminderTool, currentTimeTool } = require("./tools");

const OPENAI_REALTIME_CONFIG = {
  instructions: "You are a helpful AI assistant...",
  modalities: ["audio", "text"],
  voice: "cedar",
  input_audio_format: "pcm16",
  output_audio_format: "pcm16",
  input_audio_transcription: { model: "whisper-1" },
  turn_detection: {
    type: "server_vad",
    threshold: 0.7,
    prefix_padding_ms: 300,
    silence_duration_ms: 1200,
  },
  tools: [googleSearch, userEmotion, saveUserFacts, reminderTool, currentTimeTool],
  tool_choice: "auto",
};

module.exports = {
  OPENAI_REALTIME_CONFIG,
};
