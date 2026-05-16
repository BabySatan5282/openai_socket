const { getUserSocket } = require("../socketRegistry");

function createTriggerReminderHandler() {
  return async function triggerReminderHandler(req, res) {
    const { reminder_id, user_id, task } = req.body || {};

    if (!reminder_id || !user_id || !task) {
      return res.status(422).json({
        ok: false,
        error: "Missing required fields: reminder_id, user_id, task",
      });
    }

    const socket = getUserSocket(user_id);

    if (!socket?.connected) {
      return res.status(404).json({
        ok: false,
        error: "User not connected",
      });
    }

    try {
      const aiBridge = socket.aiBridge;

      if (!aiBridge) {
        return res.status(503).json({
          ok: false,
          error: "AI bridge is not ready for this socket",
        });
      }

      if (aiBridge.isSleeping() || !aiBridge.isAiReady()) {
        await aiBridge.wakeAiWithoutGreeting();
      }

      await aiBridge.sendReminderTaskToAi({
        task,
        reminderId: reminder_id,
      });

      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: error.message || "Failed to trigger reminder",
      });
    }
  };
}

module.exports = createTriggerReminderHandler;
