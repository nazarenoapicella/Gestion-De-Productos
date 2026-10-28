const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");

function createDatabasePath() {
  return path.join(__dirname, `.t20-${process.pid}-${randomUUID()}.sqlite`);
}

function removeDatabaseFiles(databasePath) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const filePath = `${databasePath}${suffix}`;
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = response.headers.get("content-type")?.includes("application/json")
    ? JSON.parse(text)
    : text;
  return { response, body };
}

async function withApi(databasePath, callback) {
  let database;
  let server;

  try {
    database = openDatabase(databasePath);
    const { createApp } = require("../src/app");
    server = http.createServer(createApp({ database }));
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address();
    await callback(`http://127.0.0.1:${address.port}`, database);
  } finally {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (database) {
      database.close();
    }
    removeDatabaseFiles(databasePath);
  }
}

test("T-20: flujo integrador de inventario, resumen, ajuste, edición, búsqueda y persistencia", async () => {
  const databasePath = createDatabasePath();

  await withApi(databasePath, async (baseUrl, database) => {
    const createdResponse = await requestJson(`${baseUrl}/api/products`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "  Mouse  ",
        category: " Periféricos ",
        price: "1250.50",
        stock: 5,
        description: "",
      }),
    });

    assert.equal(createdResponse.response.status, 201);
    assert.equal(createdResponse.body.name, "Mouse");
    assert.equal(createdResponse.body.category, "Periféricos");
    assert.equal(createdResponse.body.price, "1250.50");
    assert.equal(createdResponse.body.stock, 5);

    const summaryAfterCreate = await requestJson(`${baseUrl}/api/summary`);
    assert.equal(summaryAfterCreate.response.status, 200);
    assert.deepEqual(summaryAfterCreate.body, {
      productsCount: 1,
      unitsInStock: 5,
      lowStockCount: 1,
    });

    const increaseResponse = await requestJson(`${baseUrl}/api/products/${createdResponse.body.id}/stock`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "increase", quantity: 2 }),
    });

    assert.equal(increaseResponse.response.status, 200);
    assert.equal(increaseResponse.body.stock, 7);

    const summaryAfterIncrease = await requestJson(`${baseUrl}/api/summary`);
    assert.deepEqual(summaryAfterIncrease.body, {
      productsCount: 1,
      unitsInStock: 7,
      lowStockCount: 0,
    });

    const invalidDecrease = await requestJson(`${baseUrl}/api/products/${createdResponse.body.id}/stock`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation: "decrease", quantity: 8 }),
    });

    assert.equal(invalidDecrease.response.status, 400);
    assert.equal(invalidDecrease.body.error.code, "VALIDATION_ERROR");

    const stockAfterInvalidDecrease = await requestJson(`${baseUrl}/api/products/${createdResponse.body.id}`);
    assert.equal(stockAfterInvalidDecrease.response.status, 200);
    assert.equal(stockAfterInvalidDecrease.body.stock, 7);

    const summaryAfterInvalidDecrease = await requestJson(`${baseUrl}/api/summary`);
    assert.deepEqual(summaryAfterInvalidDecrease.body, {
      productsCount: 1,
      unitsInStock: 7,
      lowStockCount: 0,
    });

    const updateResponse = await requestJson(`${baseUrl}/api/products/${createdResponse.body.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Mouse Pro",
        description: "Nuevo",
        category: "Periféricos",
        price: "1599.99",
        stock: 99,
      }),
    });

    assert.equal(updateResponse.response.status, 200);
    assert.equal(updateResponse.body.stock, 7);
    assert.equal(updateResponse.body.price, "1599.99");

    const searchResponse = await requestJson(`${baseUrl}/api/products?search=mouse&category=periféricos`);
    assert.equal(searchResponse.response.status, 200);
    assert.equal(searchResponse.body.length, 1);
    assert.equal(searchResponse.body[0].name, "Mouse Pro");

    const emptySearchResponse = await requestJson(`${baseUrl}/api/products?search=router`);
    assert.equal(emptySearchResponse.response.status, 200);
    assert.deepEqual(emptySearchResponse.body, []);

    const deletedResponse = await requestJson(`${baseUrl}/api/products/${createdResponse.body.id}`, {
      method: "DELETE",
    });
    assert.equal(deletedResponse.response.status, 204);

    const summaryAfterDelete = await requestJson(`${baseUrl}/api/summary`);
    assert.deepEqual(summaryAfterDelete.body, {
      productsCount: 0,
      unitsInStock: 0,
      lowStockCount: 0,
    });

    const databaseRestart = openDatabase(databasePath);
    const { createApp: createRestartedApp } = require("../src/app");
    const restartedServer = http.createServer(createRestartedApp({ database: databaseRestart }));
    await new Promise((resolve, reject) => {
      restartedServer.once("error", reject);
      restartedServer.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = restartedServer.address();
      const restartedBaseUrl = `http://127.0.0.1:${address.port}`;
      const persistedResponse = await requestJson(`${restartedBaseUrl}/api/products`);
      assert.equal(persistedResponse.response.status, 200);
      assert.deepEqual(persistedResponse.body, []);
    } finally {
      await new Promise((resolve, reject) => {
        restartedServer.close((error) => (error ? reject(error) : resolve()));
      });
      databaseRestart.close();
    }
  });
});
