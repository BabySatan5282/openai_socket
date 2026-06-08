module.exports = {
    type: "function",
    name: "draft_email_reply",
    description: "Save a reply draft for a specific email in the user's Gmail account. Use this when the user wants to draft a reply to an email they received.",
    parameters: {
        type: "object",
        properties: {
            message_id: {
                type: "string",
                description: "The Gmail message ID of the email to reply to.",
            },
            body: {
                type: "string",
                description: "The reply body text to save as a draft.",
            },
        },
        required: ["message_id", "body"],
        additionalProperties: false,
    },
};
