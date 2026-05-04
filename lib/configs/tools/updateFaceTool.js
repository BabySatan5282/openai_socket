module.exports = {
    name: "updateFace",
    behavior: "NON_BLOCKING",
    description: `Update the visual emotion. 
- **ALLOWED EMOTIONS:** [normal, happy, sad, love, angry, cry, surprise].
- **STRICT RULE:** Call this tool ONLY when there is a significant emotional shift.`,
    parameters: {
        type: "OBJECT",
        properties: {
            emotion: { 
                type: "STRING", 
                enum: ["normal", "happy", "sad", "love", "angry", "cry", "surprise"],
                description: "The current emotional state to display."
            }
        },
        required: ["emotion"],
    },
};