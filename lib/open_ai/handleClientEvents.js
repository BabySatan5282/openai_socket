const EVENT_NAMES = require("../configs/event_names.js");
const logger = require("../utils/logger.js");
const { getUserSocketByMac } = require("../socketRegistry");

function normalizeAudioChunk(payload) {
  // Client sends raw PCM16 bytes as Socket.IO binary payloads.
  if (Buffer.isBuffer(payload)) {
    return payload.length > 0 ? payload.toString("base64") : null;
  }

  if (payload instanceof ArrayBuffer) {
    return payload.byteLength > 0 ? Buffer.from(payload).toString("base64") : null;
  }

  if (ArrayBuffer.isView(payload)) {
    return payload.byteLength > 0
      ? Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).toString("base64")
      : null;
  }

  return null;
}

function handleClientEvents(clientSocket, aiSocket, options = {}) {
  const {
    onWakeUp,
    onDisconnectCleanup,
  } = options;

  clientSocket.on(EVENT_NAMES.DO_FACTORY_RESET, (mac) => {
    logger.log(clientSocket.id, "Factory reset requested by client. device : " + mac);
    aiSocket.close();

    const userId = clientSocket.user?.userId;
    if (!userId) return;

    const targetSocket = getUserSocketByMac(userId, mac);
    if (targetSocket?.connected) {
      targetSocket.emit(EVENT_NAMES.FACTORY_RESET);
      return;
    }

    logger.log(clientSocket.id, "No matching socket found for factory reset target mac");

  });

  // Client appends raw PCM16 binary chunk.
  clientSocket.on(EVENT_NAMES.USER_AUDIO, (payload) => {

    if (!aiSocket.isReady) {
      logger.log(clientSocket.id, "[dropped] audio chunk before OpenAI ready");
      return;
    }

    const chunk = normalizeAudioChunk(payload);

    if (!chunk) {
      clientSocket.emit(EVENT_NAMES.AI_ERROR, {
        error: "Missing or invalid audio chunk. Expected direct PCM16 binary payload.",
      });
      return;
    }

    try {
      aiSocket.appendAudio(chunk);
    } catch (err) {
      logger.error(clientSocket.id, `[OpenAI SDK] Failed to append audio: ${err.message}`);
      clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message });
    }
  });

  clientSocket.on(EVENT_NAMES.WAKE_UP, async () => {
    if (typeof onWakeUp !== "function") return;

    try {
      await onWakeUp();
    } catch (err) {
      logger.error(clientSocket.id, `[WakeUp] Failed to reconnect: ${err.message}`);
      clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message || "Failed to wake AI" });
    }
  });

  // // Client signals end of push to talk.
  // clientSocket.on("realtime.input_audio_buffer.commit", () => {
  //   try {
  //     aiSocket.commitAudio();
  //   } catch (err) {
  //     clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message });
  //   }
  // });

  // // AI ရဲ့ စကားပြောမှတ်တမ်း (Context) ထဲကို စာသား (Text) ဒါမှမဟုတ် Data အသစ် ကြားဖြတ်ထည့်ဖို့ သုံးပါတယ်။ (ချက်ချင်း အဖြေမထွက်ပါ)
  // clientSocket.on("realtime.conversation.item.create", ({ item }) => {
  //   if (!item) {
  //     clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: "Missing conversation item payload." });
  //     return;
  //   }

  //   try {
  //     aiSocket.sendEvent({ type: "conversation.item.create", item });
  //   } catch (err) {
  //     clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message });
  //   }
  // });

  // // item.create နဲ့ အချက်အလက်ပို့ပြီးတာနဲ့ AI ဆီကနေ အဖြေ (Response) စတင်ထုတ်ပေးဖို့ Trigger လုပ်ခိုင်းတဲ့အခါ သုံးပါတယ်။
  // clientSocket.on("realtime.response.create", (payload = {}) => {
  //   try {
  //     aiSocket.sendEvent({ type: "response.create", ...payload });
  //   } catch (err) {
  //     clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message });
  //   }
  // });

  // // Client can update session parameters mid-conversation (e.g. change voice, adjust turn detection, etc.)
  // clientSocket.on("realtime.session.update", ({ session }) => {
  //   if (!session) {
  //     clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: "Missing session payload." });
  //     return;
  //   }

  //   try {
  //     aiSocket.updateSession(session);
  //   } catch (err) {
  //     clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message });
  //   }
  // });

  // // Catch-all for any other realtime events the client wants to send directly to OpenAI SDK.
  // clientSocket.on("realtime.raw", (event) => {
  //   if (!event || typeof event !== "object") {
  //     clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: "Invalid realtime raw event payload." });
  //     return;
  //   }

  //   try {
  //     aiSocket.sendEvent(event);
  //   } catch (err) {
  //     clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message });
  //   }
  // });

  clientSocket.on("disconnect", (reason) => {
    logger.log(clientSocket.id, `[Socket.IO] Client disconnected. Reason: ${reason}`);
    if (typeof onDisconnectCleanup === "function") {
      onDisconnectCleanup();
    }
    aiSocket.close();
  });
}

module.exports = handleClientEvents;
