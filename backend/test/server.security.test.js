const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

async function waitForServer(port) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      // retry until the server is listening
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timeout waiting for server on port ${port}`);
}

function removeDatabaseFiles(databasePath) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const filePath = `${databasePath}${suffix}`;
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
}

test("el servidor sirve la interfaz con encabezados de seguridad y bloquea el traversal", async () => {
  const port = 3600 + Math.floor(Math.random() * 1000);
  const databasePath = path.join(__dirname, `.security-${process.pid}-${randomUUID()}.sqlite`);
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      DATABASE_PATH: databasePath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(port);

    const pageResponse = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(pageResponse.status, 200);
    assert.match(await pageResponse.text(), /Stock Simple/);
    assert.equal(pageResponse.headers.get("x-powered-by"), null);
    assert.equal(pageResponse.headers.get("x-content-type-options"), "nosniff");
    assert.equal(pageResponse.headers.get("x-frame-options"), "DENY");
    assert.equal(pageResponse.headers.get("referrer-policy"), "same-origin");
    assert.match(pageResponse.headers.get("content-security-policy") || "", /default-src 'self'/);

    const stylesheetResponse = await fetch(`http://127.0.0.1:${port}/css/styles.css`);
    assert.equal(stylesheetResponse.status, 200);
    assert.match(stylesheetResponse.headers.get("content-type") || "", /text\/css/i);

    const traversalTargets = [
      `http://127.0.0.1:${port}/%2E%2E/backend/data/stock-simple.sqlite`,
      `http://127.0.0.1:${port}/%2E%2E/docs/spec.md`,
    ];

    for (const target of traversalTargets) {
      const response = await fetch(target);
      assert.equal(
        response.status,
        404,
        `La URL ${target} no debe servir archivos fuera del frontend`,
      );
    }
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      child.once("exit", resolve);
      if (child.exitCode !== null) {
        resolve();
      }
    });
    removeDatabaseFiles(databasePath);
  }
});
