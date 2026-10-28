const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const productsRepository = require("../src/repositories/products.repository");

function createDatabasePath() {
  return path.join(__dirname, `.t10-${process.pid}-${randomUUID()}.sqlite`);
}

function removeDatabaseFiles(databasePath) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const filePath = `${databasePath}${suffix}`;
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
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

function createPersistedProduct(database, name) {
  return productsRepository.create(database, {
    name,
    description: `${name} descripción`,
    category: "Prueba",
    price_cents: 12345,
    stock: 7,
  });
}

async function getProduct(baseUrl, id) {
  const response = await fetch(`${baseUrl}/api/products/${id}`);
  const text = await response.text();
  const body =
    text && response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null;
  return { response, body };
}

function assertProductDto(product, expected) {
  assert.deepEqual(Object.keys(product).sort(), [
    "category",
    "createdAt",
    "description",
    "id",
    "name",
    "price",
    "stock",
    "updatedAt",
  ]);
  assert.equal(product.id, expected.id);
  assert.equal(product.name, expected.name);
  assert.equal(product.description, expected.description);
  assert.equal(product.category, expected.category);
  assert.equal(product.price, "123.45");
  assert.equal(product.stock, 7);
  assert.equal(product.createdAt, expected.created_at);
  assert.equal(product.updatedAt, expected.updated_at);
}

function assertNotFound(response, body) {
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type") || "", /application\/json/i);
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.equal(body.error.code, "NOT_FOUND");
  assert.equal(typeof body.error.message, "string");
  assert.ok(body.error.message.length > 0);
}

test("DELETE /api/products/:id elimina solo el producto solicitado y responde 204 sin cuerpo", async () => {
  await withApi(async (baseUrl, database) => {
    const target = createPersistedProduct(database, "Producto a eliminar");
    const remaining = createPersistedProduct(database, "Producto restante");
    assert.equal(target.id, 1);
    assert.equal(remaining.id, 2);

    const response = await fetch(`${baseUrl}/api/products/${target.id}`, {
      method: "DELETE",
    });
    const responseBody = await response.text();

    assert.equal(response.status, 204);
    assert.equal(responseBody, "");

    const deletedProduct = await getProduct(baseUrl, target.id);
    assertNotFound(deletedProduct.response, deletedProduct.body);
    assert.equal(productsRepository.findById(database, target.id), null);
    assert.deepEqual(productsRepository.findAll(database), [remaining]);

    const remainingProduct = await getProduct(baseUrl, remaining.id);
    assert.equal(remainingProduct.response.status, 200);
    assertProductDto(remainingProduct.body, remaining);
  });
});

test("DELETE /api/products/:id inexistente responde 404 sin modificar los demás productos", async () => {
  await withApi(async (baseUrl, database) => {
    const first = createPersistedProduct(database, "Producto uno");
    const second = createPersistedProduct(database, "Producto dos");
    const before = productsRepository.findAll(database);

    const response = await fetch(`${baseUrl}/api/products/999999`, {
      method: "DELETE",
    });
    const text = await response.text();
    const body =
      text && response.headers.get("content-type")?.includes("application/json")
        ? JSON.parse(text)
        : null;

    assertNotFound(response, body);
    assert.deepEqual(productsRepository.findAll(database), before);

    const remainingProduct = await getProduct(baseUrl, second.id);
    assert.equal(remainingProduct.response.status, 200);
    assertProductDto(remainingProduct.body, second);
    assert.deepEqual(productsRepository.findById(database, first.id), first);
  });
});
