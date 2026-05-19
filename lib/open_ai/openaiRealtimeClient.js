const { EventEmitter } = require("events");
const OpenAI = require("openai");
const { OpenAIRealtimeWebSocket } = require("openai/realtime/websocket");

class OpenAIRealtimeClient extends EventEmitter {
  constructor({ apiKey, model }) {
    super();

    if (!apiKey) {
      throw new Error("API_KEY is required.");
    }
    if (!model) {
      throw new Error("REALTIME_MODEL is required.");
    }

    this.model = model;
    this.client = new OpenAI({ apiKey });
    this.realtime = null;
    this.isReady = false;
  }

  async connect(session) {
    this.realtime = await OpenAIRealtimeWebSocket.create(this.client, { model: this.model });

    await new Promise((resolve, reject) => {
      this.realtime.on("event", (event) => {
        if (event.type === "session.created") {
          if (session) this.updateSession(session);
          this.isReady = true;
          resolve();
        }
        this.emit("event", event);
      });

      this.realtime.on("error", (err) => {
        this.emit("error", err);
        if (!this.isReady) reject(err);
      });
    });

    // The SDK exposes close events from the underlying ws socket.
    if (this.realtime.socket && typeof this.realtime.socket.on === "function") {
      this.realtime.socket.on("close", (code, reason) => {
        this.emit("close", {
          code,
          reason: reason ? reason.toString() : "",
        });
      });
    }
  }

  assertConnected() {
    if (!this.realtime) {
      throw new Error("Realtime session is not connected.");
    }
  }

  sendEvent(event) {
    this.assertConnected();
    this.realtime.send(event);
  }

  updateSession(session) {
    this.sendEvent({
      type: "session.update",
      session,
    });
  }

  appendAudio(audio) {
    this.sendEvent({
      type: "input_audio_buffer.append",
      audio,
    });
  }

  commitAudio() {
    this.sendEvent({
      type: "input_audio_buffer.commit",
    });
  }

  close() {
    if (!this.realtime) return;

    this.isReady = false;
    const realtime = this.realtime;
    this.realtime = null;
    try {
      realtime.close({ code: 1000, reason: "Client disconnected" });
    } catch {
      // Ignore close errors during shutdown.
    }
  }
}

module.exports = OpenAIRealtimeClient;
