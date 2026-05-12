
const { googleSearch, updateFace, saveUserFacts } = require("./tools");

const OPENAI_REALTIME_CONFIG = {
  instructions: "You are a helpful AI assistant...",
  modalities: ["audio", "text"],
  voice: "verse",
  input_audio_format: "pcm16",
  output_audio_format: "pcm16",
  input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
  turn_detection: {
    type: "server_vad",
    threshold: 0.7,
    prefix_padding_ms: 300,
    silence_duration_ms: 800,
  },
  tools: [googleSearch, updateFace, saveUserFacts],
  tool_choice: "auto",
};

module.exports = {
  OPENAI_REALTIME_CONFIG,
};
