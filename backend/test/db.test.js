const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

// Contract: backend/src/db/index.js exports openDatabase(path), initializes
// products idempotently, and returns a SQLite connection with prepare/close.
const databaseModule = "../src/db";

function createDatabasePath() {
  return path.join(__dirname, `.t01-${process.pid}-${randomUUID()}.sqlite`);
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
    const { openDatabase } = require(databaseModule);
    database = openDatabase(databasePath);
    callback(database, databasePath);
  } finally {
    if (database) {
      database.close();
    }
    removeDatabaseFiles(databasePath);
  }
}

function insertProduct(database, { name, category, priceCents, stock }) {
  const now = new Date().toISOString();
  return database
    .prepare(
      `INSERT INTO products
        (name, category, price_cents, stock, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(name, category, priceCents, stock, now, now);
}

test("inicializa una base nueva sin productos", () => {
  withDatabase((database) => {
    const result = database.prepare("SELECT COUNT(*) AS count FROM products").get();
    assert.equal(result.count, 0);
  });
});

test("acepta price_cents=0 y stock=0", () => {
  withDatabase((database) => {
    insertProduct(database, {
      name: "Producto cero",
      category: "Prueba",
      priceCents: 0,
      stock: 0,
    });

    const product = database
      .prepare("SELECT price_cents, stock FROM products")
      .get();
    assert.equal(product.price_cents, 0);
    assert.equal(product.stock, 0);
  });
});

test("rechaza price_cents=-1", () => {
  withDatabase((database) => {
    assert.throws(
      () =>
        insertProduct(database, {
          name: "Precio inválido",
          category: "Prueba",
          priceCents: -1,
          stock: 0,
        }),
      /constraint failed/i,
    );
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM products").get().count,
      0,
    );
  });
});

test("rechaza stock=-1", () => {
  withDatabase((database) => {
    assert.throws(
      () =>
        insertProduct(database, {
          name: "Stock inválido",
          category: "Prueba",
          priceCents: 0,
          stock: -1,
        }),
      /constraint failed/i,
    );
    assert.equal(
      database.prepare("SELECT COUNT(*) AS count FROM products").get().count,
      0,
    );
  });
});

test("persiste Mouse al cerrar y reabrir la base SQLite", () => {
  const databasePath = createDatabasePath();
  let database;

  try {
    const { openDatabase } = require(databaseModule);
    database = openDatabase(databasePath);
    insertProduct(database, {
      name: "Mouse",
      category: "Periféricos",
      priceCents: 125050,
      stock: 5,
    });
    database.close();
    database = null;

    database = openDatabase(databasePath);
    const product = database
      .prepare(
        "SELECT name, category, price_cents, stock FROM products",
      )
      .get();
    assert.equal(product.name, "Mouse");
    assert.equal(product.category, "Periféricos");
    assert.equal(product.price_cents, 125050);
    assert.equal(product.stock, 5);
  } finally {
    if (database) {
      database.close();
    }
    removeDatabaseFiles(databasePath);
  }
});

test("reinicializar al reabrir no elimina filas existentes", () => {
  const databasePath = createDatabasePath();
  let database;

  try {
    const { openDatabase } = require(databaseModule);
    database = openDatabase(databasePath);
    insertProduct(database, {
      name: "Mouse",
      category: "Periféricos",
      priceCents: 125050,
      stock: 5,
    });
    database.close();
    database = null;

    database = openDatabase(databasePath);
    const count = database
      .prepare("SELECT COUNT(*) AS count FROM products")
      .get().count;
    assert.equal(count, 1);
    assert.equal(
      database.prepare("SELECT name FROM products").get().name,
      "Mouse",
    );
  } finally {
    if (database) {
      database.close();
    }
    removeDatabaseFiles(databasePath);
  }
});
