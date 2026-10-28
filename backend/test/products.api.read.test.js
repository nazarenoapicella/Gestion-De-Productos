const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const productsRepository = require("../src/repositories/products.repository");
const { listProducts } = require("../src/services/products.service");

function createDatabasePath() {
  return path.join(__dirname, `.t07-${process.pid}-${randomUUID()}.sqlite`);
}

function removeDatabaseFiles(databasePath) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const filePath = `${databasePath}${suffix}`;
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
}

function createProductsService(database) {
  return {
    listProducts(filters) {
      return listProducts(
        {
          findAll: (normalizedFilters) =>
            productsRepository.findAll(database, normalizedFilters),
        },
        filters,
      );
    },
    findProduct(id) {
      return productsRepository.findById(database, Number(id));
    },
  };
}

async function withApi(callback, { products = [], overrideService } = {}) {
  const databasePath = createDatabasePath();
  let database;
  let server;

  try {
    database = openDatabase(databasePath);
    for (const product of products) {
      productsRepository.create(database, {
        description: null,
        price_cents: 0,
        stock: 0,
        ...product,
      });
    }

    const productsService = createProductsService(database);
    const { createApp } = require("../src/app");
    const app = createApp({
      database,
      productsService: overrideService
        ? overrideService(productsService)
        : productsService,
    });

    server = http.createServer(app);
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

async function getJson(url) {
  const response = await fetch(url);
  return {
    response,
    body: await response.json(),
  };
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
  assert.equal(typeof product.id, "number");
  assert.equal(product.name, expected.name);
  assert.equal(product.description, expected.description ?? null);
  assert.equal(product.category, expected.category);
  assert.equal(product.price, expected.price);
  assert.equal(typeof product.price, "string");
  assert.equal(product.stock, expected.stock);
  for (const timestamp of [product.createdAt, product.updatedAt]) {
    assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(new Date(timestamp).toISOString(), timestamp);
  }
}

const mouse = {
  name: "Mouse",
  category: "Periféricos",
  price_cents: 125050,
  stock: 5,
};

const keyboard = {
  name: "Teclado",
  category: "Periféricos",
  price_cents: 90000,
  stock: 3,
};

const mousepad = {
  name: "Mousepad",
  category: "Accesorios",
  price_cents: 25000,
  stock: 8,
};

test("GET /api/products devuelve 200 y una lista vacía con inventario vacío", async () => {
  await withApi(async (baseUrl) => {
    const { response, body } = await getJson(`${baseUrl}/api/products`);

    assert.equal(response.status, 200);
    assert.deepEqual(body, []);
  });
});

test("GET /api/products devuelve los productos ordenados por nombre ascendente", async () => {
  await withApi(
    async (baseUrl) => {
      const { response, body } = await getJson(`${baseUrl}/api/products`);

      assert.equal(response.status, 200);
      assert.deepEqual(
        body.map((product) => product.name),
        ["Mouse", "Mousepad", "Teclado"],
      );
      assertProductDto(body[0], {
        ...mouse,
        price: "1250.50",
      });
      assertProductDto(body[1], {
        ...mousepad,
        price: "250.00",
      });
      assertProductDto(body[2], {
        ...keyboard,
        price: "900.00",
      });
    },
    { products: [keyboard, mousepad, mouse] },
  );
});

test("GET /api/products conserva ambos filtros y los combina con AND", async () => {
  await withApi(
    async (baseUrl) => {
      const url = new URL(`${baseUrl}/api/products`);
      url.searchParams.set("search", "mouse");
      url.searchParams.set("category", "Periféricos");
      const { response, body } = await getJson(url);

      assert.equal(response.status, 200);
      assert.deepEqual(
        body.map((product) => product.name),
        ["Mouse"],
      );
    },
    { products: [mouse, keyboard, mousepad] },
  );
});

test("GET /api/products/:id devuelve el producto con el DTO acordado", async () => {
  await withApi(
    async (baseUrl, database) => {
      const [storedProduct] = productsRepository.findAll(database);
      const { response, body } = await getJson(
        `${baseUrl}/api/products/${storedProduct.id}`,
      );

      assert.equal(response.status, 200);
      assertProductDto(body, {
        ...mouse,
        price: "1250.50",
      });
    },
    { products: [mouse] },
  );
});

test("GET /api/products/:id devuelve 404 sin alterar productos existentes", async () => {
  await withApi(
    async (baseUrl, database) => {
      const before = productsRepository.findAll(database);
      const { response, body } = await getJson(
        `${baseUrl}/api/products/999999`,
      );

      assert.equal(response.status, 404);
      assert.equal(body.error.code, "NOT_FOUND");
      assert.equal(typeof body.error.message, "string");
      assert.ok(body.error.message.length > 0);
      assert.deepEqual(productsRepository.findAll(database), before);
    },
    { products: [mouse] },
  );
});

test("un fallo de lectura devuelve un error controlado sin lista ficticia ni traza", async () => {
  await withApi(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/products`);
      const text = await response.text();

      assert.equal(response.status, 500);
      assert.match(response.headers.get("content-type") || "", /application\/json/i);
      const body = JSON.parse(text);
      assert.deepEqual(Object.keys(body), ["error"]);
      assert.equal(body.error.code, "INTERNAL_SERVER_ERROR");
      assert.equal(typeof body.error.message, "string");
      assert.ok(body.error.message.length > 0);
      assert.doesNotMatch(text, /SIMULATED_READ_FAILURE|stack|Error:/i);
    },
    {
      overrideService: (service) => ({
        ...service,
        listProducts() {
          throw new Error("SIMULATED_READ_FAILURE");
        },
      }),
    },
  );
});
