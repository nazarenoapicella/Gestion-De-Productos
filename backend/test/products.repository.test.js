const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");

const repositoryModule = "../src/repositories/products.repository";

function createDatabasePath() {
  return path.join(__dirname, `.t02-${process.pid}-${randomUUID()}.sqlite`);
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
    callback(database, databasePath);
  } finally {
    if (database) {
      database.close();
    }
    removeDatabaseFiles(databasePath);
  }
}

function createInput(overrides = {}) {
  return {
    name: "Mouse",
    description: "Mouse inalámbrico",
    category: "Periféricos",
    price_cents: 125050,
    stock: 5,
    ...overrides,
  };
}

function assertIsoUtc(value) {
  assert.equal(typeof value, "string");
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(value).toISOString(), value);
}

test("A: permite nombres repetidos con identificadores y registros distintos", () => {
  withDatabase((database) => {
    const repository = require(repositoryModule);
    const first = repository.create(database, createInput({ stock: 5 }));
    const second = repository.create(
      database,
      createInput({ stock: 8, price_cents: 150000 }),
    );

    assert.notEqual(first.id, second.id);
    assert.equal(first.name, "Mouse");
    assert.equal(second.name, "Mouse");
    assert.equal(repository.findById(database, first.id).stock, 5);
    assert.equal(repository.findById(database, second.id).stock, 8);
  });
});

test("B: findById devuelve solo el producto pedido o null si no existe", () => {
  withDatabase((database) => {
    const repository = require(repositoryModule);
    const first = repository.create(database, createInput());
    const second = repository.create(
      database,
      createInput({ name: "Teclado", stock: 2 }),
    );

    assert.equal(repository.findById(database, first.id).id, first.id);
    assert.equal(repository.findById(database, second.id).id, second.id);
    assert.equal(repository.findById(database, first.id).name, "Mouse");
    assert.equal(repository.findById(database, 999999), null);
  });
});

test("C: actualiza por ID, conserva el stock omitido y no toca otro producto", () => {
  withDatabase((database) => {
    const repository = require(repositoryModule);
    const first = repository.create(database, createInput({ stock: 5 }));
    const second = repository.create(
      database,
      createInput({ name: "Teclado", stock: 12, price_cents: 90000 }),
    );

    const updated = repository.update(database, first.id, {
      name: "Mouse Pro",
      description: "Descripción actualizada",
      category: "Accesorios",
      price_cents: 175000,
    });

    assert.equal(updated.id, first.id);
    assert.equal(updated.name, "Mouse Pro");
    assert.equal(updated.description, "Descripción actualizada");
    assert.equal(updated.category, "Accesorios");
    assert.equal(updated.price_cents, 175000);
    assert.equal(updated.stock, 5);
    assert.equal(repository.findById(database, second.id).id, second.id);
    assert.equal(repository.findById(database, second.id).name, "Teclado");
    assert.equal(repository.findById(database, second.id).price_cents, 90000);
    assert.equal(repository.findById(database, second.id).stock, 12);
  });
});

test("D: deleteById elimina solo el producto solicitado y conserva los restantes", () => {
  withDatabase((database) => {
    const repository = require(repositoryModule);
    const removed = repository.create(database, createInput());
    const remaining = repository.create(
      database,
      createInput({ name: "Teclado", stock: 3 }),
    );

    assert.equal(repository.deleteById(database, removed.id), true);
    assert.equal(repository.findById(database, removed.id), null);
    assert.equal(repository.findById(database, remaining.id).name, "Teclado");
    assert.deepEqual(
      repository.findAll(database).map((product) => product.id),
      [remaining.id],
    );
  });
});

test("E: conserva los datos y marcas de tiempo al cerrar y reabrir SQLite", () => {
  const databasePath = createDatabasePath();
  let database;

  try {
    database = openDatabase(databasePath);
    const repository = require(repositoryModule);
    const created = repository.create(database, createInput());
    assertIsoUtc(created.created_at);
    assertIsoUtc(created.updated_at);

    database.close();
    database = null;

    database = openDatabase(databasePath);
    const reopenedRepository = require(repositoryModule);
    assert.deepEqual(
      reopenedRepository.findById(database, created.id),
      created,
    );
  } finally {
    if (database) {
      database.close();
    }
    removeDatabaseFiles(databasePath);
  }
});

test("F: findAll devuelve una lista vacía y luego los productos existentes", () => {
  withDatabase((database) => {
    const repository = require(repositoryModule);

    assert.deepEqual(repository.findAll(database), []);

    const first = repository.create(database, createInput());
    const second = repository.create(
      database,
      createInput({ name: "Teclado", stock: 0 }),
    );
    const products = repository.findAll(database);

    assert.equal(products.length, 2);
    assert.deepEqual(
      new Set(products.map((product) => product.id)),
      new Set([first.id, second.id]),
    );
  });
});

test("G: conserva como literales datos con apariencia de SQL", () => {
  withDatabase((database) => {
    const repository = require(repositoryModule);
    const input = createInput({
      name: "Mouse'); DROP TABLE products; --",
      description: "Texto'); DELETE FROM products; --",
      category: "Periféricos' OR '1'='1",
    });

    const created = repository.create(database, input);

    assert.equal(created.name, input.name);
    assert.equal(created.description, input.description);
    assert.equal(created.category, input.category);
    assert.equal(repository.findAll(database).length, 1);
    assert.equal(repository.findById(database, created.id).name, input.name);
  });
});

test("H: actualizar o borrar un ID inexistente no tiene efectos", () => {
  withDatabase((database) => {
    const repository = require(repositoryModule);
    const existing = repository.create(database, createInput());
    const before = repository.findAll(database);
    const missingId = existing.id + 999999;

    assert.equal(
      repository.update(database, missingId, {
        name: "No debe crearse",
        description: "Sin cambios",
        category: "Prueba",
        price_cents: 1,
      }),
      null,
    );
    assert.equal(repository.deleteById(database, missingId), false);
    assert.deepEqual(repository.findAll(database), before);
    assert.equal(repository.findById(database, existing.id).name, "Mouse");
  });
});
