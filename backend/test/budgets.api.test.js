const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const productsRepository = require("../src/repositories/products.repository");

function createDatabasePath() {
  return path.join(__dirname, `.budgets-${process.pid}-${randomUUID()}.sqlite`);
}

function removeDatabaseFiles(databasePath) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const filePath = `${databasePath}${suffix}`;
    if (existsSync(filePath)) unlinkSync(filePath);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

async function withApi(callback) {
  const databasePath = createDatabasePath();
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
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    if (database) database.close();
    removeDatabaseFiles(databasePath);
  }
}

function createProduct(database, { name = "Teclado", price = 125050, stock = 10 } = {}) {
  return productsRepository.create(database, {
    name,
    description: null,
    category: "Periféricos",
    price_cents: price,
    stock,
  });
}

function createBudgetRequest(baseUrl, items) {
  return requestJson(`${baseUrl}/api/budgets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

test("crear presupuesto descuenta stock, conserva importes y genera un PDF válido", async () => {
  await withApi(async (baseUrl, database) => {
    const keyboard = createProduct(database, { name: "Teclado mecánico", price: 125050, stock: 8 });
    const mouse = createProduct(database, { name: "Mouse óptico", price: 5999, stock: 6 });

    const { response, body } = await createBudgetRequest(baseUrl, [
      { productId: keyboard.id, quantity: 2 },
      { productId: mouse.id, quantity: 3 },
    ]);

    assert.equal(response.status, 201);
    assert.equal(body.status, "pending");
    assert.equal(body.total, "2680.97");
    assert.equal(body.items.length, 2);
    assert.equal(body.items[0].productName, "Teclado mecánico");
    assert.equal(body.items[0].unitPrice, "1250.50");
    assert.equal(body.items[0].lineTotal, "2501.00");
    assert.equal(productsRepository.findById(database, keyboard.id).stock, 6);
    assert.equal(productsRepository.findById(database, mouse.id).stock, 3);

    const pdfResponse = await fetch(`${baseUrl}/api/budgets/${body.id}/pdf`);
    const pdf = Buffer.from(await pdfResponse.arrayBuffer());
    assert.equal(pdfResponse.status, 200);
    assert.match(pdfResponse.headers.get("content-type"), /application\/pdf/);
    assert.match(pdfResponse.headers.get("content-disposition"), /presupuesto-/);
    assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
    assert.ok(pdf.includes(Buffer.from("PRESUPUESTO")));

    const list = await requestJson(`${baseUrl}/api/budgets`);
    assert.equal(list.response.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].id, body.id);
  });
});

test("marcar como pagado no devuelve el stock y un presupuesto resuelto no se puede cambiar otra vez", async () => {
  await withApi(async (baseUrl, database) => {
    const product = createProduct(database, { stock: 9 });
    const created = await createBudgetRequest(baseUrl, [{ productId: product.id, quantity: 4 }]);
    assert.equal(created.response.status, 201);
    assert.equal(productsRepository.findById(database, product.id).stock, 5);

    const paid = await requestJson(`${baseUrl}/api/budgets/${created.body.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    assert.equal(paid.response.status, 200);
    assert.equal(paid.body.status, "paid");
    assert.equal(productsRepository.findById(database, product.id).stock, 5);

    const secondResolution = await requestJson(`${baseUrl}/api/budgets/${created.body.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    assert.equal(secondResolution.response.status, 409);
    assert.equal(secondResolution.body.error.code, "BUDGET_ALREADY_RESOLVED");
    assert.equal(productsRepository.findById(database, product.id).stock, 5);
  });
});

test("rechazar devuelve stock exactamente una vez y queda asentado en el historial", async () => {
  await withApi(async (baseUrl, database) => {
    const product = createProduct(database, { stock: 7 });
    const created = await createBudgetRequest(baseUrl, [{ productId: product.id, quantity: 3 }]);
    assert.equal(productsRepository.findById(database, product.id).stock, 4);

    const rejected = await requestJson(`${baseUrl}/api/budgets/${created.body.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.body.status, "rejected");
    assert.equal(productsRepository.findById(database, product.id).stock, 7);

    const repeated = await requestJson(`${baseUrl}/api/budgets/${created.body.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    assert.equal(repeated.response.status, 409);
    assert.equal(productsRepository.findById(database, product.id).stock, 7);

    const list = await requestJson(`${baseUrl}/api/budgets`);
    assert.equal(list.body[0].status, "rejected");
  });
});

test("rechaza cantidades inválidas y stock insuficiente sin reservar parcialmente", async () => {
  await withApi(async (baseUrl, database) => {
    const first = createProduct(database, { name: "Monitor", stock: 5 });
    const second = createProduct(database, { name: "Impresora", stock: 1 });

    const invalid = await createBudgetRequest(baseUrl, [{ productId: first.id, quantity: 0 }]);
    assert.equal(invalid.response.status, 400);
    assert.equal(productsRepository.findById(database, first.id).stock, 5);

    const insufficient = await createBudgetRequest(baseUrl, [
      { productId: first.id, quantity: 3 },
      { productId: second.id, quantity: 2 },
    ]);
    assert.equal(insufficient.response.status, 409);
    assert.equal(insufficient.body.error.code, "INSUFFICIENT_STOCK");
    assert.equal(productsRepository.findById(database, first.id).stock, 5);
    assert.equal(productsRepository.findById(database, second.id).stock, 1);
    assert.equal(database.prepare("SELECT COUNT(*) AS count FROM budgets").get().count, 0);
  });
});

test("no permite eliminar productos con reservas pendientes y conserva la fotografía del presupuesto", async () => {
  await withApi(async (baseUrl, database) => {
    const product = createProduct(database, { name: "Router Wi-Fi", price: 40000, stock: 4 });
    const created = await createBudgetRequest(baseUrl, [{ productId: product.id, quantity: 2 }]);

    const blockedDelete = await fetch(`${baseUrl}/api/products/${product.id}`, { method: "DELETE" });
    assert.equal(blockedDelete.status, 409);

    const updated = await requestJson(`${baseUrl}/api/products/${product.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Router Wi-Fi nuevo", category: "Redes", price: "999.99", description: "Actualizado" }),
    });
    assert.equal(updated.response.status, 200);

    const detail = await requestJson(`${baseUrl}/api/budgets/${created.body.id}`);
    assert.equal(detail.body.items[0].productName, "Router Wi-Fi");
    assert.equal(detail.body.items[0].unitPrice, "400.00");

    const rejected = await requestJson(`${baseUrl}/api/budgets/${created.body.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
    assert.equal(rejected.response.status, 200);
    assert.equal(productsRepository.findById(database, product.id).stock, 4);

    const allowedDelete = await fetch(`${baseUrl}/api/products/${product.id}`, { method: "DELETE" });
    assert.equal(allowedDelete.status, 204);
  });
});
