import app from "./app";
import { logger } from "./lib/logger";
import { createServer } from "node:http";
import { initSocket } from "./socket";
import { startScheduler } from "./scheduler";

const rawPort = process.env["PORT"] || "5000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

// Initialize Socket.io
initSocket(server);

server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening on 0.0.0.0");
  startScheduler();
});
