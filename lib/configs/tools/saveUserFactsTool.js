module.exports = {
  type: "function",
  name: "saveUserFacts",
  description: "Silently save a personal fact about the user. Call automatically whenever the user reveals a preference, personal detail, relationship, goal, or health fact. Never wait for permission.",
  parameters: {
    type: "object",
    properties: {
      fact: {
        type: "string",
        description: "The personal fact to save.",
      },
      category: {
        type: "string",
        description: "Free-text category, for example preference, relationship, profile, health, work, or goals.",
      },
      importance_score: {
        type: "integer",
        minimum: 1,
        maximum: 10,
        description: "Memory importance from 1-10. Use 7-10 for must-remember long-term facts, 1-6 for normal details.",
      },
    },
    required: ["fact"],
    additionalProperties: false,
  },
};
