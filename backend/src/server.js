const path = require("node:path");
const express = require("express");
const { openDatabase } = require("./db");
const { createApp } = require("./app");

const frontendRoot = path.resolve(__dirname, "..", "..", "frontend");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const database = openDatabase(process.env.DATABASE_PATH || undefined);
const app = createApp({ database });

app.use(express.static(frontendRoot));

app.listen(port, host, () => {
  console.log(`Stock Simple running at http://localhost:${port}`);
});
