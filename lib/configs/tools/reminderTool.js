module.exports = {
    type: "function",
    name: "setReminder",
    description: "Create a reminder for the user by saving a task and reminder datetime to the Laravel API. Always call getCurrentTime immediately before every setReminder call.",
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
        },
        required: ["task", "remind_at"],
        additionalProperties: false,
    },
};
