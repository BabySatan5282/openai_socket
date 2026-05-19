const { getUserSockets } = require("../socketRegistry");

function createTriggerReminderHandler() {
  return async function triggerReminderHandler(req, res) {
    const { reminder_id, user_id, task } = req.body || {};

    if (!reminder_id || !user_id || !task) {
      return res.status(422).json({
        ok: false,
        error: "Missing required fields: reminder_id, user_id, task",
      });
    }

    const sockets = getUserSockets(user_id).filter(s => s && s.connected);
    if (sockets.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "User not connected on any device",
      });
    }

    let successCount = 0;
    let errorCount = 0;
    let lastError = null;
    for (const socket of sockets) {
      try {
        const aiBridge = socket.aiBridge;
        if (!aiBridge) {
          errorCount++;
          lastError = "AI bridge is not ready for this socket";
          continue;
        }
        if (aiBridge.isSleeping() || !aiBridge.isAiReady()) {
          await aiBridge.wakeAiWithoutGreeting();
        }
        await aiBridge.sendReminderTaskToAi({
          task,
          reminderId: reminder_id,
        });
        successCount++;
      } catch (error) {
        errorCount++;
        lastError = error.message || "Failed to trigger reminder";
      }
    }
    if (successCount > 0) {
      return res.json({ ok: true, delivered: successCount, failed: errorCount });
    } else {
      return res.status(500).json({
        ok: false,
        error: lastError || "Failed to trigger reminder on all devices",
      });
    }
  };
}

module.exports = createTriggerReminderHandler;
