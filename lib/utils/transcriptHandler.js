function normalizeTranscriptText(value) {
    if (typeof value !== "string") return "";
    
    // Replace newlines with spaces but keep original spaces
    // We don't use .trim() here because delta chunks might legitimately start/end with a space
    let text = value.replace(/[\r\n]+/g, " ");
    
    // Fix spaces before punctuations (e.g. "Hello , world ." -> "Hello, world.")
    text = text.replace(/\s+([.,!?:;])/g, "$1");
    
    // Fix spaces before English contractions (e.g. "I 'm", "it 's" -> "I'm", "it's")
    text = text.replace(/\s+(['’](s|m|ll|re|ve|d|t)\b)/gi, "$1");
    text = text.replace(/n\s+(['’]t)\b/gi, "n$1"); // specially for "n 't" -> "n't"
    
    return text;
}

function extractTranscriptText(transcription) {
    if (!transcription) return "";
    if (typeof transcription === "string") return normalizeTranscriptText(transcription);
    return normalizeTranscriptText(transcription.text || "..");
}


module.exports = {
    normalizeTranscriptText,
    extractTranscriptText,
};