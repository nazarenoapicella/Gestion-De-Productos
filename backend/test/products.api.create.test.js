const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const productsRepository = require("../src/repositories/products.repository");

function createDatabasePath() {
  return path.join(__dirname, `.t08-${process.pid}-${randomUUID()}.sqlite`);
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

async function requestJson(url, method, value) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
  return { response, body: await response.json() };
}

function assertProductDto(product, { name, description = null, category }) {
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
  assert.equal(Number.isSafeInteger(product.id), true);
  assert.ok(product.id > 0);
  assert.equal(product.name, name);
  assert.equal(product.description, description);
  assert.equal(product.category, category);
  assert.equal(product.price, "1250.50");
  assert.equal(product.stock, 5);
  for (const timestamp of [product.createdAt, product.updatedAt]) {
    assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(new Date(timestamp).toISOString(), timestamp);
  }
}

function assertValidationError(response, body) {
  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type") || "", /application\/json/i);
  assert.deepEqual(Object.keys(body), ["error"]);
  assert.equal(body.error.code, "VALIDATION_ERROR");
  assert.equal(typeof body.error.message, "string");
  assert.ok(body.error.message.length > 0);
}

const validInput = {
  name: "  Mouse  ",
  category: " Periféricos ",
  price: "1250.50",
  stock: 5,
  description: "",
};

test("POST /api/products crea el producto, normaliza los campos y devuelve el DTO persistido", async () => {
  await withApi(async (baseUrl, database) => {
    const { response, body } = await requestJson(
      `${baseUrl}/api/products`,
      "POST",
      validInput,
    );

    assert.equal(response.status, 201);
    assert.match(response.headers.get("content-type") || "", /application\/json/i);
    assertProductDto(body, {
      name: "Mouse",
      category: "Periféricos",
    });

    const stored = productsRepository.findById(database, body.id);
    assert.deepEqual(stored, {
      id: body.id,
      name: "Mouse",
      description: null,
      category: "Periféricos",
      price_cents: 125050,
      stock: 5,
      created_at: body.createdAt,
      updated_at: body.updatedAt,
    });

    const { response: readResponse, body: readBody } = await requestJson(
      `${baseUrl}/api/products/${body.id}`,
      "GET",
    );
    assert.equal(readResponse.status, 200);
    assert.deepEqual(readBody, body);
  });
});

test("POST /api/products acepta description omitida y la conserva como null", async () => {
  await withApi(async (baseUrl, database) => {
    const { description, ...inputWithoutDescription } = validInput;
    const { response, body } = await requestJson(
      `${baseUrl}/api/products`,
      "POST",
      inputWithoutDescription,
    );

    assert.equal(response.status, 201);
    assertProductDto(body, {
      name: "Mouse",
      category: "Periféricos",
    });
    assert.equal(
      productsRepository.findById(database, body.id).description,
      null,
    );
  });
});

const invalidInputs = [
  ["nombre vacío", { ...validInput, name: "" }],
  ["nombre con espacios", { ...validInput, name: "   " }],
  ["categoría vacía", { ...validInput, category: "" }],
  ["categoría con espacios", { ...validInput, category: "   " }],
  ["precio negativo", { ...validInput, price: "-1" }],
  ["precio no numérico", { ...validInput, price: "abc" }],
  ["precio con más de dos decimales", { ...validInput, price: "1250.505" }],
  ["stock negativo", { ...validInput, stock: -1 }],
  ["stock decimal", { ...validInput, stock: 1.5 }],
];

for (const [description, input] of invalidInputs) {
  test(`POST /api/products rechaza ${description} sin insertar un producto`, async () => {
    await withApi(async (baseUrl, database) => {
      const { response, body } = await requestJson(
        `${baseUrl}/api/products`,
        "POST",
        input,
      );

      assertValidationError(response, body);
      assert.deepEqual(productsRepository.findAll(database), []);
    });
  });
}

test("POST /api/products permite repetir el nombre y preserva el registro original", async () => {
  await withApi(async (baseUrl, database) => {
    const original = productsRepository.create(database, {
      name: "Mouse",
      description: "Original",
      category: "Periféricos",
      price_cents: 80000,
      stock: 2,
    });

    const { response, body } = await requestJson(
      `${baseUrl}/api/products`,
      "POST",
      validInput,
    );

    assert.equal(response.status, 201);
    assert.notEqual(body.id, original.id);
    assertProductDto(body, {
      name: "Mouse",
      category: "Periféricos",
    });
    assert.deepEqual(productsRepository.findById(database, original.id), original);

    const sameNameProducts = productsRepository
      .findAll(database)
      .filter((product) => product.name === "Mouse");
    assert.equal(sameNameProducts.length, 2);
    assert.notEqual(sameNameProducts[0].id, sameNameProducts[1].id);
  });
});
