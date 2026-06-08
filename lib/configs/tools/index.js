
const googleSearch = require('./googleSearch');
const userEmotion = require('./updateFaceTool');
const saveUserFacts = require('./saveUserFactsTool');
const reminderTool = require('./reminderTool');
const currentTimeTool = require('./currentTimeTool');
const checkEmailTool = require('./checkEmailTool');
const draftReplyTool = require('./draftReplyTool');

module.exports = {
    googleSearch,
    userEmotion,
    saveUserFacts,
    reminderTool,
    currentTimeTool,
    checkEmailTool,
    draftReplyTool,
};