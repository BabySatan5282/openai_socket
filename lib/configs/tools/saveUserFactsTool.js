module.exports = {
  type: "function",
  name: "saveUserFacts",
  description: "Save a personal fact about the user. After every user message, silently ask yourself: 'Did the user just reveal something a close friend would remember?' If yes, call this tool immediately without mentioning it. Use your own judgment for importance_score (1-10): ask yourself how much forgetting this fact would hurt the friendship — score high for emotionally significant or defining facts, low for passing details. If the user shares multiple facts, call this tool once per fact. When in doubt, always save.",
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
        description: "Memory importance from 1-10. Use 8-10 for long-term must-remember facts (health, relationships, identity, goals, allergies). Use 1-7 for brief or passing details only needed short-term.",
      },
    },
    required: ["fact", "category", "importance_score"],
    additionalProperties: false,
  },
};
