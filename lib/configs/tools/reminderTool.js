module.exports = {
    type: "function",
    name: "setReminder",
    description: "Create a reminder for the user by saving a task, reminder datetime, and recurrence info to the Laravel API. Always call getCurrentTime immediately before every setReminder call.",
    parameters: {
        type: "object",
        properties: {
            task: {
                type: "string",
                description: "The reminder task or message."
            },
            remind_at: {
                type: "string",
                description: "The reminder date/time string. Prefer user-local wall-clock format (e.g. 2026-05-16 09:00:00) without Z/offset."
            },
            recurrence_type: {
                type: "string",
                description: "Recurrence type: 'once', 'daily', or 'weekly'. Default is 'once'."
            },
            recurrence_meta: {
                type: "string",
                description: "For weekly, the day of week (e.g. 'Monday'). For daily or once, leave empty or null."
            },
        },
        required: ["task", "remind_at", "recurrence_type"],
        additionalProperties: false,
    },
};
