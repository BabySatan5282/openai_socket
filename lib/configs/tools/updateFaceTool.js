module.exports = {
    type: "function",
    name: "updateFace",
    description: "Update the displayed facial emotion. Call only on significant emotional shifts.",
    parameters: {
        type: "object",
        properties: {
            emotion: {
                type: "string",
                enum: ["normal", "happy", "sad", "love", "angry", "cry", "surprise"],
                description: "The current emotional state to display.",
            },
        },
        required: ["emotion"],
        additionalProperties: false,
    },
};