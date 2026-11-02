const path = require("node:path");
const express = require("express");
const { openDatabase } = require("./db");
const { createApp } = require("./app");

const frontendRoot = path.resolve(__dirname, "..", "..", "frontend");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST || "127.0.0.1";

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new TypeError("PORT debe ser un número entero entre 0 y 65535.");
}

const database = openDatabase(process.env.DATABASE_PATH || undefined);
const app = createApp({ database });
app.use(express.static(frontendRoot, { dotfiles: "deny", index: "index.html" }));

const server = app.listen(port, host, () => {
  const address = server.address();
  const listeningPort = typeof address === "object" && address ? address.port : port;
  console.log(`Stock Simple running at http://${host}:${listeningPort}`);
});

function shutdown(signal) {
  console.log(`\n${signal}: cerrando Stock Simple...`);
  server.close((error) => {
    if (error) {
      console.error("No se pudo cerrar el servidor limpiamente:", error);
      process.exitCode = 1;
    }
    database.close();
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
