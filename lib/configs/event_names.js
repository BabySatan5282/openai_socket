const EVENT_NAMES = {
    ERROR: "error",
    SOCKET_ERROR: "socketError",
    AI_AUDIO: "aiAudio",
    AI_STREAM_DONE: "aiStreamDone",
    AI_AUDIO_DONE : "aiAudioDone",
    INPUT_TRANSCRIPT: "inputTranscript",
    OUTPUT_TRANSCRIPT: "outputTranscript",
    SPEECH_STARTED: "speechStarted",
    SPEECH_STOPPED: "speechStopped",
    CONVERSATION_CREATED: "conversationCreated",
    EMOTION: "emotion",
    AI_SLEEP: "aiSleep",
    USER_AUDIO: "userAudio",
    AI_READY : "aiReady",
    AI_ERROR : "aiError",
};

module.exports = EVENT_NAMES;
