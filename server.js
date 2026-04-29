require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const OpenAIRealtimeClient = require("./lib/openaiRealtimeClient");
const EVENT_NAMES = require("./configs/event_names.js");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";

if (!OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment.");
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("OpenAI Realtime Voice Chat Server is running."));

// ─── Socket.IO: Client Connection ─────────────────────────────────────────────
io.on("connection", (clientSocket) => {
  console.log(`[Socket.IO] Client connected: ${clientSocket.id}`);

  const aiSocket = new OpenAIRealtimeClient({
    apiKey: OPENAI_API_KEY,
    model: OPENAI_REALTIME_MODEL,
  });

  const relayRealtimeEvent = (event) => {
    switch (event.type) {
      case "response.audio.delta":
        console.log(`🤖 [OpenAI SDK] Relaying audio delta to client ${clientSocket.id}. Size: ${event.delta ? event.delta.length : 0} bytes`);
        clientSocket.emit(EVENT_NAMES.AI_AUDIO, { data: event.delta });
        break;
      case "response.audio.done":
        clientSocket.emit(EVENT_NAMES.AI_AUDIO_DONE);
        break;
      case "response.done":
        clientSocket.emit(EVENT_NAMES.AI_STREAM_DONE, event);
        break;
      case "response.audio_transcript.delta":
        clientSocket.emit(EVENT_NAMES.OUTPUT_TRANSCRIPT, event.delta);
        break;
      case "response.audio_transcript.done":
        clientSocket.emit("realtime.response.audio_transcript.done", event.transcript);
        break;
      case "input_audio_buffer.speech_started":
        clientSocket.emit(EVENT_NAMES.SPEECH_STARTED);
        break;
      case "input_audio_buffer.speech_stopped":
        clientSocket.emit(EVENT_NAMES.SPEECH_STOPPED);
        break;
      case "conversation.item.input_audio_transcription.completed":
        clientSocket.emit(EVENT_NAMES.INPUT_TRANSCRIPT, event.transcript);
        break;

      case "error":
        clientSocket.emit(EVENT_NAMES.SOCKET_ERROR, { error: event.error || event });
        break;
      default:
        clientSocket.emit("realtime.raw", event);
        break;
    }
  };

  aiSocket.on("event", relayRealtimeEvent);

  aiSocket.on("error", (err) => {
    console.error(`[OpenAI SDK] Realtime error for client ${clientSocket.id}:`, err.message);
    clientSocket.emit("realtime.error", { error: err.message });
  });

  aiSocket.on("close", ({ code, reason }) => {
    console.log(`[OpenAI SDK] Realtime closed for client ${clientSocket.id}. Code: ${code}`);
    clientSocket.emit("realtime.disconnected", { code, reason });
  });

  aiSocket
    .connect({
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
    })
    .then(() => {
      clientSocket.emit("realtime.ready", { model: OPENAI_REALTIME_MODEL });
    })
    .catch((err) => {
      console.error(`[OpenAI SDK] Failed to connect for ${clientSocket.id}:`, err.message);
      clientSocket.emit("realtime.error", {
        error:
          err.message ||
          "Failed to connect to OpenAI Realtime API. Ensure model access and billing tier.",
      });
    });

  // Client appends Base64 PCM16 chunk.
  clientSocket.on(EVENT_NAMES.USER_AUDIO, (payload) => {
    // If payload is a string, use it directly (Backward compatibility for Flutter direct string emit)
    // If payload is an object, try to extract audio or delta
    const chunk = typeof payload === "string" ? payload : (payload?.audio || payload?.delta);

    if (!chunk || typeof chunk !== "string") {
      clientSocket.emit(EVENT_NAMES.SOCKET_ERROR, { error: "Missing audio chunk for append." });
      return;
    }

    try {
      aiSocket.appendAudio(chunk);
    } catch (err) {
      clientSocket.emit(EVENT_NAMES.SOCKET_ERROR, { error: err.message });
    }
  });

  // Client signals end of push to talk.
  clientSocket.on("realtime.input_audio_buffer.commit", () => {
    try {
      aiSocket.commitAudio();
    } catch (err) {
      clientSocket.emit("realtime.error", { error: err.message });
    }
  });

  // AI ရဲ့ စကားပြောမှတ်တမ်း (Context) ထဲကို စာသား (Text) ဒါမှမဟုတ် Data အသစ် ကြားဖြတ်ထည့်ဖို့ သုံးပါတယ်။ (ချက်ချင်း အဖြေမထွက်ပါ)
  clientSocket.on("realtime.conversation.item.create", ({ item }) => {
    if (!item) {
      clientSocket.emit("realtime.error", { error: "Missing conversation item payload." });
      return;
    }

    try {
      aiSocket.sendEvent({ type: "conversation.item.create", item });
    } catch (err) {
      clientSocket.emit("realtime.error", { error: err.message });
    }
  });

  // item.create နဲ့ အချက်အလက်ပို့ပြီးတာနဲ့ AI ဆီကနေ အဖြေ (Response) စတင်ထုတ်ပေးဖို့ Trigger လုပ်ခိုင်းတဲ့အခါ သုံးပါတယ်။
  clientSocket.on("realtime.response.create", (payload = {}) => {
    try {
      aiSocket.sendEvent({ type: "response.create", ...payload });
    } catch (err) {
      clientSocket.emit("realtime.error", { error: err.message });
    }
  });
  // Client can update session parameters mid-conversation (e.g. change voice, adjust turn detection, etc.)
  clientSocket.on("realtime.session.update", ({ session }) => {
    if (!session) {
      clientSocket.emit("realtime.error", { error: "Missing session payload." });
      return;
    }

    try {
      aiSocket.updateSession(session);
    } catch (err) {
      clientSocket.emit("realtime.error", { error: err.message });
    }
  });
  // Catch-all for any other realtime events the client wants to send directly to OpenAI SDK.
  clientSocket.on("realtime.raw", (event) => {
    if (!event || typeof event !== "object") {
      clientSocket.emit("realtime.error", { error: "Invalid realtime raw event payload." });
      return;
    }

    try {
      aiSocket.sendEvent(event);
    } catch (err) {
      clientSocket.emit("realtime.error", { error: err.message });
    }
  });

  clientSocket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${clientSocket.id}. Reason: ${reason}`);
    aiSocket.close();
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
