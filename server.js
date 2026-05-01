require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const handleConnection = require("./lib/open_ai/connectSocket.js");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("Realtime Voice Chat Server is running."));

// ─── Socket.IO: Client Connection ─────────────────────────────────────────────
io.on("connection", handleConnection);

// ─── Start Server ──────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
