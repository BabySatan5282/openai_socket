function isValidTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function formatParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const mapped = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${mapped.year}-${mapped.month}-${mapped.day} ${mapped.hour}:${mapped.minute}:${mapped.second}`;
}

function handleCurrentTimeToolCall(clientSocket, aiSocket, event, sendFunctionOutput) {
  let args = {};
  try {
    args = event.arguments ? JSON.parse(event.arguments) : {};
  } catch {
    sendFunctionOutput(aiSocket, event.call_id, { ok: false, error: "Invalid function arguments JSON." });
    return;
  }

  const requestedTimezone = typeof args.timezone === "string" ? args.timezone.trim() : "";
  const userTimezone = clientSocket.user?.timezone || "UTC";
  const candidateTimezone = requestedTimezone || userTimezone;
  const finalTimezone = isValidTimeZone(candidateTimezone) ? candidateTimezone : "UTC";

  const now = new Date();
  const localDateTime = formatParts(now, finalTimezone);


  // Get day of week in the requested timezone
  const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: finalTimezone }).format(now);
  const output = {
    ok: true,
    timezone: finalTimezone,
    local_datetime: localDateTime,
    day_of_week: dayOfWeek,
    utc_iso: now.toISOString(),
    unix_ms: now.getTime(),
    source: "server_clock",
  };
  sendFunctionOutput(aiSocket, event.call_id, output);
  if (clientSocket && clientSocket.id && typeof require === 'function') {
    const logger = require("../../utils/logger.js");
    logger.log(clientSocket.id, `[getCurrentTime] sent output: ${JSON.stringify(output, null, 2)}`);
  }

  
}

module.exports = {
  handleCurrentTimeToolCall,
};
