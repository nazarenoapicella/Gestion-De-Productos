const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const productsRepository = require("../src/repositories/products.repository");

function createDatabasePath() {
  return path.join(__dirname, `.t11-${process.pid}-${randomUUID()}.sqlite`);
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

function createProduct(database, overrides = {}) {
  return productsRepository.create(database, {
    name: "Producto objetivo",
    description: "Descripción original",
    category: "Categoría original",
    price_cents: 12345,
    stock: 8,
    ...overrides,
  });
}

async function patchStock(baseUrl, id, input) {
  const response = await fetch(`${baseUrl}/api/products/${id}/stock`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await response.text();
  const body = response.headers.get("content-type")?.includes("application/json")
    ? JSON.parse(text)
    : null;

  return { response, body };
}

function assertIsoUtc(value) {
  assert.equal(typeof value, "string");
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(value).toISOString(), value);
}

function assertProductDto(product, expected, stock) {
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
  assert.equal(product.stock, stock);
  assertIsoUtc(product.createdAt);
  assertIsoUtc(product.updatedAt);
  assert.equal(product.createdAt, expected.created_at);
}

function assertErrorResponse(response, body, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") || "", /application\/json/i);
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.ok(
    Object.keys(body.error).sort().join(",") === "code,message" ||
      Object.keys(body.error).sort().join(",") === "code,fields,message",
  );
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, "string");
  assert.ok(body.error.message.length > 0);
  if (Object.hasOwn(body.error, "fields")) {
    assert.ok(
      body.error.fields !== null &&
        typeof body.error.fields === "object" &&
        !Array.isArray(body.error.fields),
    );
  }
}

function assertUnchanged(database, target, other) {
  assert.deepEqual(productsRepository.findById(database, target.id), target);
  assert.deepEqual(productsRepository.findById(database, other.id), other);
}

test("PATCH /api/products/:id/stock aumenta 8 a 11 y luego disminuye a 7", async () => {
  await withApi(async (baseUrl, database) => {
    const target = createProduct(database);
    const other = createProduct(database, {
      name: "Otro producto",
      description: "No debe modificarse",
      category: "Otra categoría",
      price_cents: 98765,
      stock: 3,
    });

    const increased = await patchStock(baseUrl, target.id, {
      operation: "increase",
      quantity: 3,
    });
    assert.equal(increased.response.status, 200);
    assert.match(
      increased.response.headers.get("content-type") || "",
      /application\/json/i,
    );
    assertProductDto(increased.body, target, 11);
    assert.deepEqual(productsRepository.findById(database, target.id), {
      ...target,
      stock: 11,
      updated_at: increased.body.updatedAt,
    });
    assert.deepEqual(productsRepository.findById(database, other.id), other);

    const decreased = await patchStock(baseUrl, target.id, {
      operation: "decrease",
      quantity: 4,
    });
    assert.equal(decreased.response.status, 200);
    assert.match(
      decreased.response.headers.get("content-type") || "",
      /application\/json/i,
    );
    assertProductDto(decreased.body, target, 7);
    assert.deepEqual(productsRepository.findById(database, target.id), {
      ...target,
      stock: 7,
      updated_at: decreased.body.updatedAt,
    });
    assert.deepEqual(productsRepository.findById(database, other.id), other);
  });
});

test("PATCH /api/products/:id/stock rechaza una disminución superior al stock sin cambios", async () => {
  await withApi(async (baseUrl, database) => {
    const target = createProduct(database, { stock: 7 });
    const other = createProduct(database, { stock: 3 });

    const { response, body } = await patchStock(baseUrl, target.id, {
      operation: "decrease",
      quantity: 8,
    });

    assertErrorResponse(response, body, 400, "VALIDATION_ERROR");
    assertUnchanged(database, target, other);
  });
});

const invalidAdjustments = [
  ["cantidad cero", { operation: "increase", quantity: 0 }],
  ["cantidad negativa", { operation: "decrease", quantity: -1 }],
  ["cantidad decimal", { operation: "increase", quantity: 1.5 }],
  ["operación reset", { operation: "reset", quantity: 1 }],
];

for (const [description, input] of invalidAdjustments) {
  test(`PATCH /api/products/:id/stock rechaza ${description} sin cambios`, async () => {
    await withApi(async (baseUrl, database) => {
      const target = createProduct(database, { stock: 7 });
      const other = createProduct(database, { stock: 3 });

      const { response, body } = await patchStock(baseUrl, target.id, input);

      assertErrorResponse(response, body, 400, "VALIDATION_ERROR");
      assertUnchanged(database, target, other);
    });
  });
}

test("PATCH /api/products/:id/stock devuelve NOT_FOUND para un ID inexistente", async () => {
  await withApi(async (baseUrl, database) => {
    const target = createProduct(database);
    const other = createProduct(database, { stock: 3 });

    const { response, body } = await patchStock(baseUrl, 999999, {
      operation: "increase",
      quantity: 1,
    });

    assertErrorResponse(response, body, 404, "NOT_FOUND");
    assertUnchanged(database, target, other);
  });
});

test("PATCH /api/products/:id/stock rechaza JSON malformado sin cambios", async () => {
  await withApi(async (baseUrl, database) => {
    const target = createProduct(database, { stock: 7 });
    const other = createProduct(database, { stock: 3 });
    const response = await fetch(
      `${baseUrl}/api/products/${target.id}/stock`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{",
      },
    );
    const text = await response.text();
    const body = response.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(text)
      : null;

    assertErrorResponse(response, body, 400, "VALIDATION_ERROR");
    assertUnchanged(database, target, other);
  });
});
