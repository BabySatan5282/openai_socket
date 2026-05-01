const EVENT_NAMES = require("../configs/event_names.js");
const logger = require("../utils/logger.js");

function handleClientEvents(clientSocket, aiSocket) {
  // Client appends Base64 PCM16 chunk.
  clientSocket.on(EVENT_NAMES.USER_AUDIO, (payload) => {
    if (!aiSocket.isReady) {
      logger.log(clientSocket.id, "[dropped] audio chunk before OpenAI ready");
      return;
    }

    // If payload is a string, use it directly (Backward compatibility for Flutter direct string emit)
    // If payload is an object, try to extract audio or delta
    const chunk = typeof payload === "string" ? payload : (payload?.audio || payload?.delta);

    if (!chunk || typeof chunk !== "string") {
      clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: "Missing audio chunk for append." });
      return;
    }

    try {
      aiSocket.appendAudio(chunk);
    } catch (err) {
      logger.error(clientSocket.id, `[OpenAI SDK] Failed to append audio: ${err.message}`);
      clientSocket.emit(EVENT_NAMES.AI_ERROR, { error: err.message });
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
    aiSocket.close();
  });
}

module.exports = handleClientEvents;
