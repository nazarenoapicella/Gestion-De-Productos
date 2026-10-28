const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const productsRepository = require("../src/repositories/products.repository");

function createDatabasePath() {
  return path.join(__dirname, `.t12-${process.pid}-${randomUUID()}.sqlite`);
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

function createProduct(database, name, stock) {
  return productsRepository.create(database, {
    name,
    description: `${name} description`,
    category: "Prueba",
    price_cents: 12500,
    stock,
  });
}

async function getSummary(baseUrl) {
  const response = await fetch(`${baseUrl}/api/summary`);
  const text = await response.text();
  const body = response.headers.get("content-type")?.includes("application/json")
    ? JSON.parse(text)
    : null;

  return { response, body };
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

function assertSummary(response, body, expected) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /application\/json/i);
  assert.deepEqual(Object.keys(body).sort(), [
    "lowStockCount",
    "productsCount",
    "unitsInStock",
  ]);
  assert.deepEqual(body, expected);
}

test("GET /api/summary devuelve los indicadores en cero con inventario vacío sin mutarlo", async () => {
  await withApi(async (baseUrl, database) => {
    const before = productsRepository.findAll(database);

    const { response, body } = await getSummary(baseUrl);

    assertSummary(response, body, {
      productsCount: 0,
      unitsInStock: 0,
      lowStockCount: 0,
    });
    assert.deepEqual(productsRepository.findAll(database), before);
  });
});

test("GET /api/summary cuenta productos con stock 0, 5 y 6 sin alterar los productos", async () => {
  await withApi(async (baseUrl, database) => {
    createProduct(database, "Sin stock", 0);
    createProduct(database, "Stock bajo", 5);
    createProduct(database, "Stock normal", 6);
    const before = productsRepository.findAll(database);

    const { response, body } = await getSummary(baseUrl);

    assertSummary(response, body, {
      productsCount: 3,
      unitsInStock: 11,
      lowStockCount: 2,
    });
    assert.deepEqual(productsRepository.findAll(database), before);
  });
});

test("GET /api/summary refleja el PATCH de stock sin mutar otros productos ni datos", async () => {
  await withApi(async (baseUrl, database) => {
    const zeroStockProduct = createProduct(database, "Sin stock", 0);
    const fiveStockProduct = createProduct(database, "Stock bajo", 5);
    const sixStockProduct = createProduct(database, "Stock normal", 6);

    const { response: initialResponse, body: initialSummary } =
      await getSummary(baseUrl);
    assertSummary(initialResponse, initialSummary, {
      productsCount: 3,
      unitsInStock: 11,
      lowStockCount: 2,
    });

    const { response: patchResponse, body: patchedProduct } = await patchStock(
      baseUrl,
      fiveStockProduct.id,
      { operation: "increase", quantity: 2 },
    );
    assert.equal(patchResponse.status, 200);
    assert.equal(patchedProduct.id, fiveStockProduct.id);
    assert.equal(patchedProduct.stock, 7);

    const afterPatch = productsRepository.findAll(database);
    assert.deepEqual(
      productsRepository.findById(database, fiveStockProduct.id),
      {
        ...fiveStockProduct,
        stock: 7,
        updated_at: patchedProduct.updatedAt,
      },
    );
    assert.deepEqual(
      productsRepository.findById(database, zeroStockProduct.id),
      zeroStockProduct,
    );
    assert.deepEqual(
      productsRepository.findById(database, sixStockProduct.id),
      sixStockProduct,
    );

    const { response, body } = await getSummary(baseUrl);

    assertSummary(response, body, {
      productsCount: 3,
      unitsInStock: 13,
      lowStockCount: 1,
    });
    assert.deepEqual(productsRepository.findAll(database), afterPatch);
  });
});
