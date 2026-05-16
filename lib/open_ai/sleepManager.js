const EVENT_NAMES = require("../configs/event_names.js");
const logger = require("../utils/logger.js");

const INACTIVITY_TIMEOUT_MS = parseInt(process.env.AI_INACTIVITY_TIMEOUT_MS) || 3 * 60 * 1000;

function createSleepManager({
  clientSocket,
  aiSocket,
}) {
  let inactivityTimer = null;
  let isSleeping = false;
  let isReconnecting = false;

  const clear = () => {
    if (!inactivityTimer) return;
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  };

  const reset = () => {
    clear();
    inactivityTimer = setTimeout(() => {
      if (!clientSocket.connected || isSleeping) return;
      isSleeping = true;
      aiSocket.close();
      clientSocket.emit(EVENT_NAMES.AI_SLEEP);
      logger.log(clientSocket.id, `[Inactivity] AI put to sleep after ${INACTIVITY_TIMEOUT_MS}ms idle.`);
    }, INACTIVITY_TIMEOUT_MS);
  };

  const markAwake = () => {
    isSleeping = false;
  };

  const isAsleep = () => isSleeping;

  const wakeUp = async ({ connect, onReady }) => {
    if (!isSleeping && aiSocket.isReady) {
      reset();
      return;
    }
    if (isReconnecting) return;

    isReconnecting = true;
    try {
      await connect();
      isSleeping = false;
      if (typeof onReady === "function") {
        onReady();
      }
      reset();
    } finally {
      isReconnecting = false;
    }
  };

  return {
    reset,
    clear,
    markAwake,
    isAsleep,
    wakeUp,
  };
}

module.exports = {
  createSleepManager,
};