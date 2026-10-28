const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const productsRepository = require("../src/repositories/products.repository");

function createDatabasePath() {
  return path.join(__dirname, `.t09-${process.pid}-${randomUUID()}.sqlite`);
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

async function putProduct(baseUrl, id, input) {
  const response = await fetch(`${baseUrl}/api/products/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await response.text();
  const body = response.headers.get("content-type")?.includes("application/json")
    ? JSON.parse(text)
    : null;

  return { response, body, text };
}

function createPersistedProduct(database, overrides = {}) {
  return productsRepository.create(database, {
    name: "Mouse",
    description: "Mouse inalámbrico",
    category: "Periféricos",
    price_cents: 100000,
    stock: 5,
    ...overrides,
  });
}

function assertIsoUtc(value) {
  assert.equal(typeof value, "string");
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(value).toISOString(), value);
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
  assert.equal(product.price, expected.price);
  assert.equal(typeof product.price, "string");
  assert.equal(product.stock, expected.stock);
  assertIsoUtc(product.createdAt);
  assertIsoUtc(product.updatedAt);
}

function assertValidationError(response, body) {
  assert.equal(response.status, 400);
  assert.match(
    response.headers.get("content-type") || "",
    /application\/json/i,
  );
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.equal(typeof body.error.message, "string");
  assert.ok(body.error.message.length > 0);
}

const editInput = {
  name: "Mouse Pro",
  description: "Mouse inalámbrico actualizado",
  category: "Accesorios",
  price: "1500.00",
};

test("PUT /api/products/:id edita campos permitidos, ignora stock y devuelve el DTO persistido", async () => {
  await withApi(async (baseUrl, database) => {
    const original = createPersistedProduct(database);
    const other = createPersistedProduct(database, {
      name: "Teclado",
      description: "Teclado mecánico",
      category: "Periféricos",
      price_cents: 90000,
      stock: 12,
    });

    const { response, body } = await putProduct(baseUrl, original.id, {
      ...editInput,
      stock: 99,
    });

    assert.equal(
      response.status,
      200,
      "PUT /api/products/:id debe estar implementado y responder 200",
    );
    assert.match(
      response.headers.get("content-type") || "",
      /application\/json/i,
    );
    assertProductDto(body, {
      id: original.id,
      ...editInput,
      price: "1500.00",
      stock: 5,
    });

    const persisted = productsRepository.findById(database, original.id);
    assert.deepEqual(persisted, {
      id: original.id,
      name: "Mouse Pro",
      description: "Mouse inalámbrico actualizado",
      category: "Accesorios",
      price_cents: 150000,
      stock: 5,
      created_at: original.created_at,
      updated_at: body.updatedAt,
    });
    assert.equal(body.createdAt, original.created_at);
    assert.equal(body.updatedAt, persisted.updated_at);
    assert.deepEqual(productsRepository.findById(database, other.id), other);
  });
});

test("PUT /api/products/:id permite omitir description", async () => {
  await withApi(async (baseUrl, database) => {
    const original = createPersistedProduct(database);
    const { description, ...inputWithoutDescription } = editInput;

    const { response, body } = await putProduct(
      baseUrl,
      original.id,
      inputWithoutDescription,
    );

    assert.equal(
      response.status,
      200,
      "description es opcional en una actualización",
    );
    assertProductDto(body, {
      id: original.id,
      ...inputWithoutDescription,
      description: null,
      price: "1500.00",
      stock: 5,
    });
    const persisted = productsRepository.findById(database, original.id);
    assert.equal(persisted.description, null);
    assert.equal(persisted.price_cents, 150000);
    assert.equal(persisted.stock, 5);
    assert.equal(persisted.name, body.name);
    assert.equal(persisted.category, body.category);
    assert.equal(persisted.updated_at, body.updatedAt);
  });
});

const invalidUpdates = [
  ["nombre solo con espacios", { name: "   " }],
  ["nombre que supera 100 caracteres", { name: "n".repeat(101) }],
  ["categoría vacía", { category: "   " }],
  ["categoría que supera 50 caracteres", { category: "c".repeat(51) }],
  ["descripción que supera 500 caracteres", { description: "d".repeat(501) }],
  ["precio negativo", { price: "-1" }],
  ["precio no numérico", { price: "abc" }],
  ["precio con más de dos decimales", { price: "1500.505" }],
  ["precio que no se envía como texto", { price: 1500 }],
];

for (const [label, invalidField] of invalidUpdates) {
  test(`PUT /api/products/:id rechaza ${label} sin modificar ningún producto`, async () => {
    await withApi(async (baseUrl, database) => {
      const original = createPersistedProduct(database);
      const other = createPersistedProduct(database, {
        name: "Teclado",
        description: "Teclado mecánico",
        category: "Periféricos",
        price_cents: 90000,
        stock: 12,
      });
      const before = productsRepository.findAll(database);

      const { response, body } = await putProduct(baseUrl, original.id, {
        ...editInput,
        stock: 99,
        ...invalidField,
      });

      assertValidationError(response, body);
      assert.deepEqual(productsRepository.findAll(database), before);
      assert.deepEqual(productsRepository.findById(database, original.id), original);
      assert.deepEqual(productsRepository.findById(database, other.id), other);
    });
  });
}

test("PUT /api/products/999999 responde 404 NOT_FOUND y no modifica otros productos", async () => {
  await withApi(async (baseUrl, database) => {
    const product = createPersistedProduct(database);
    const other = createPersistedProduct(database, {
      name: "Teclado",
      description: "Teclado mecánico",
      category: "Periféricos",
      price_cents: 90000,
      stock: 12,
    });
    const before = productsRepository.findAll(database);

    const { response, body, text } = await putProduct(baseUrl, 999999, editInput);

    assert.equal(
      response.status,
      404,
      "PUT /api/products/999999 debe responder 404",
    );
    assert.match(
      response.headers.get("content-type") || "",
      /application\/json/i,
    );
    assert.equal(body.error.code, "NOT_FOUND");
    assert.equal(typeof body.error.message, "string");
    assert.ok(body.error.message.length > 0);
    assert.doesNotMatch(text, /stack|Error:/i);
    assert.deepEqual(productsRepository.findAll(database), before);
    assert.deepEqual(productsRepository.findById(database, product.id), product);
    assert.deepEqual(productsRepository.findById(database, other.id), other);
  });
});
