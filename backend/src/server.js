const path = require("node:path");
const { existsSync, statSync } = require("node:fs");
const { openDatabase } = require("./db");
const { createApp } = require("./app");

const frontendRoot = path.resolve(__dirname, "..", "..", "frontend");
const port = Number(process.env.PORT || 3000);
const database = openDatabase(process.env.DATABASE_PATH || undefined);
const app = createApp({ database });

app.use((request, response, next) => {
  if (request.path.startsWith("/api/")) {
    next();
    return;
  }

  const safePath = request.path === "/" ? "index.html" : request.path.replace(/^\/+/, "");
  const resolved = path.join(frontendRoot, safePath);

  if (safePath && existsSync(resolved) && statSync(resolved).isFile()) {
    response.sendFile(resolved);
    return;
  }

  if (request.path === "/") {
    response.sendFile(path.join(frontendRoot, "index.html"));
    return;
  }

  next();
});
app.use(require("express").static(frontendRoot));

app.get("/", (request, response) => {
  response.sendFile(path.join(frontendRoot, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Stock Simple running at http://localhost:${port}`);
});
