const registry = {};

function normalizeMacAddress(macAddress) {
  if (typeof macAddress !== "string") return null;
  const normalized = macAddress.trim().toLowerCase();
  return normalized || null;
}

// deviceId is always socket.id
function setUserSocket(userId, socket) {
  userId = String(userId);
  const deviceId = String(socket.id);
  if (!registry[userId]) registry[userId] = {};
  socket.macAddress = normalizeMacAddress(socket.user?.macAddress);
  registry[userId][deviceId] = socket;
}

// Get all sockets for a user
function getUserSockets(userId) {
  userId = String(userId);
  return registry[userId] ? Object.values(registry[userId]) : [];
}

function getUserSocketByMac(userId, macAddress) {
  const normalizedMac = normalizeMacAddress(macAddress);
  if (!normalizedMac) return null;

  const sockets = getUserSockets(userId);
  return sockets.find((socket) => socket?.macAddress === normalizedMac) ?? null;
}

// Remove socket by userId/deviceId or by socketId
function removeUserSocket(userId, socketId) {
  userId = String(userId);
  if (!registry[userId]) return;
  for (const [deviceId, sock] of Object.entries(registry[userId])) {
    if (sock.id === socketId) {
      delete registry[userId][deviceId];
    }
  }
  // Clean up empty user
  if (Object.keys(registry[userId]).length === 0) delete registry[userId];
}

module.exports = { setUserSocket, getUserSockets, getUserSocketByMac, removeUserSocket };
