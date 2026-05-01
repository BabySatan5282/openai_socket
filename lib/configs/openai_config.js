const OPENAI_REALTIME_CONFIG = {
  modalities: ["audio", "text"],
  voice: "alloy",
  input_audio_format: "pcm16",
  output_audio_format: "pcm16",
  input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
  turn_detection: {
    type: "server_vad",
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 500,
  },
};

module.exports = {
  OPENAI_REALTIME_CONFIG,
};
