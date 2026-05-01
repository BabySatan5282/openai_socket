function getFormattedTime() {
    return new Date().toISOString();
}

function log(id, message) {
    console.log(`[${getFormattedTime()}] [${id}] ${message}`);
}

function error(id, message) {
    console.error(`[${getFormattedTime()}] [${id}] ${message}`);
}

module.exports = {
    log,
    error
};
