const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");

// Contract proposal: summary.repository.getSummary(database) returns exactly
// { productsCount, unitsInStock, lowStockCount }; summary.service.getSummary(
// repository) delegates to repository.getSummary() and returns that value.
function createDatabasePath() {
  return path.join(__dirname, `.t06-${process.pid}-${randomUUID()}.sqlite`);
}

function removeDatabaseFiles(databasePath) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const filePath = `${databasePath}${suffix}`;
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
}

function withDatabase(callback) {
  const databasePath = createDatabasePath();
  let database;

  try {
    database = openDatabase(databasePath);
    callback(database);
  } finally {
    if (database) {
      database.close();
    }
    removeDatabaseFiles(databasePath);
  }
}

test("el repository devuelve ceros para una base SQLite vacía", () => {
  withDatabase((database) => {
    const repository = require("../src/repositories/summary.repository");

    assert.deepEqual(repository.getSummary(database), {
      productsCount: 0,
      unitsInStock: 0,
      lowStockCount: 0,
    });
  });
});

test("el service delega al repository y refleja la eliminación desde SQLite", () => {
  withDatabase((database) => {
    const productsRepository = require("../src/repositories/products.repository");
    const { getSummary } = require("../src/services/summary.service");
    const summaryRepository = require("../src/repositories/summary.repository");
    const productAtZero = productsRepository.create(database, {
      name: "Producto sin stock",
      description: null,
      category: "Prueba",
      price_cents: 0,
      stock: 0,
    });

    productsRepository.create(database, {
      name: "Producto con cinco unidades",
      description: null,
      category: "Prueba",
      price_cents: 0,
      stock: 5,
    });
    productsRepository.create(database, {
      name: "Producto con seis unidades",
      description: null,
      category: "Prueba",
      price_cents: 0,
      stock: 6,
    });

    let repositoryCalls = 0;
    let repositoryValue;
    const repositoryAdapter = {
      getSummary() {
        repositoryCalls += 1;
        repositoryValue = summaryRepository.getSummary(database);
        return repositoryValue;
      },
    };

    const initialSummary = getSummary(repositoryAdapter);
    assert.strictEqual(initialSummary, repositoryValue);
    assert.equal(repositoryCalls, 1);
    assert.deepEqual(initialSummary, {
      productsCount: 3,
      unitsInStock: 11,
      lowStockCount: 2,
    });

    assert.equal(
      productsRepository.deleteById(database, productAtZero.id),
      true,
    );

    const summaryAfterDelete = getSummary(repositoryAdapter);
    assert.strictEqual(summaryAfterDelete, repositoryValue);
    assert.equal(repositoryCalls, 2);
    assert.deepEqual(summaryAfterDelete, {
      productsCount: 2,
      unitsInStock: 11,
      lowStockCount: 1,
    });
  });
});
