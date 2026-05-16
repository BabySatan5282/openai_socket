const registry = {};

function setUserSocket(userId, socket) {
  registry[String(userId)] = socket;
}

function getUserSocket(userId) {
  return registry[String(userId)] || null;
}

function removeUserSocket(userId, socketId) {
  const sock = registry[String(userId)];
  if (sock && sock.id === socketId) delete registry[String(userId)];
}

module.exports = { setUserSocket, getUserSocket, removeUserSocket };
