const EVENT_NAMES = {
    ERROR: "error",
    SOCKET_ERROR: "socketError",
    AI_AUDIO: "aiAudio",
    AI_STREAM_DONE: "aiStreamDone",
    AI_AUDIO_DONE : "aiAudioDone",
    INPUT_TRANSCRIPT: "inputTranscript",
    OUTPUT_TRANSCRIPT: "outputTranscript",
    SEARCH_STARTED: "searchStarted",
    SEARCH_COMPLETED: "searchCompleted",
    SEARCH_FAILED: "searchFailed",
    SPEECH_STARTED: "speechStarted",
    SPEECH_STOPPED: "speechStopped",
    CONVERSATION_CREATED: "conversationCreated",
    EMOTION: "emotion",
    AI_SLEEP: "aiSleep",
    WAKE_UP : "wakeUp",
    USER_AUDIO: "userAudio",
    AI_READY : "aiReady",
    AI_ERROR : "aiError",
};

module.exports = EVENT_NAMES;
