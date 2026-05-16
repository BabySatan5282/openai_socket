require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const handleConnection = require("./lib/open_ai/connectSocket.js");
const { authenticateClient } = require("./lib/utils/authHelper.js");
const createTriggerReminderHandler = require("./lib/api/triggerReminder.js");
const { setUserSocket, removeUserSocket } = require("./lib/socketRegistry");

const app = express();
app.use(express.json());
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("Realtime Voice Chat Server is running."));
app.post("/internal/trigger-reminder", createTriggerReminderHandler());

io.use(async (socket, next) => {
  try {
    socket.user = await authenticateClient(socket.handshake.auth || {});
    next();
  } catch (error) {
    console.error(`[Authentication Error] ${error.message}`);
    next(new Error(error.message || "Authentication failed."));
  }
});

// ─── Socket.IO: Client Connection ─────────────────────────────────────────────
io.on("connection", (socket) => {
  const userId = socket.user?.userId;

  if (userId) {
    setUserSocket(userId, socket);
  }

  socket.on("disconnect", () => {
    if (userId) removeUserSocket(userId, socket.id);
  });

  handleConnection(socket);
});

// ─── Start Server ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
