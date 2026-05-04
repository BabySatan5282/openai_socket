module.exports = {
    type: "function",
    name: "google_search",
    description: "Search the web for recent facts, news, and weather.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "Search query text.",
            },
        },
        required: ["query"],
        additionalProperties: false,
    },
};