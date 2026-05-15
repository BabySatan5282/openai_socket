module.exports = {
    type: "function",
    name: "getCurrentTime",
    description: "Get exact current date/time from server clock for a timezone.",
    parameters: {
        type: "object",
        properties: {
            timezone: {
                type: "string",
                description: "IANA timezone, e.g. Asia/Bangkok. If omitted, user's timezone is used.",
            },
        },
        additionalProperties: false,
    },
};
