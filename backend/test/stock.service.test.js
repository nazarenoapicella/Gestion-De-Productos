const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { Worker } = require("node:worker_threads");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const { adjustStock } = require("../src/services/stock.service");

// Contract: adjustStock(repository, id, { operation, quantity }) returns the
// updated product, passes not_found through explicitly, and throws controlled
// errors with VALIDATION_ERROR or INSUFFICIENT_STOCK codes. The repository
// exposes adjustStock(id, operation, quantity) and returns discriminated
// updated, not_found, or insufficient_stock results.
const repositoryModule = "../src/repositories/products.repository";

function createDatabasePath() {
  return path.join(__dirname, `.t04-${process.pid}-${randomUUID()}.sqlite`);
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
    stock: 8,
    ...overrides,
  };
}

function createRepository(database) {
  const repository = require(repositoryModule);
  return {
    create(fields) {
      return repository.create(database, fields);
    },
    findById(id) {
      return repository.findById(database, id);
    },
    findAll() {
      return repository.findAll(database);
    },
    adjustStock(id, operation, quantity) {
      return repository.adjustStock(database, id, operation, quantity);
    },
  };
}

function assertValidationError(action) {
  assert.throws(action, { code: "VALIDATION_ERROR" });
}

function runConcurrentAdjustment(databasePath, id) {
  const workerSource = `
    const { parentPort, workerData } = require("node:worker_threads");
    const { openDatabase } = require(workerData.databaseModule);
    const repositoryModule = require(workerData.repositoryModule);
    const { adjustStock } = require(workerData.serviceModule);
    const database = openDatabase(workerData.databasePath);
    const repository = {
      adjustStock(productId, operation, quantity) {
        return repositoryModule.adjustStock(database, productId, operation, quantity);
      }
    };
    try {
      const product = adjustStock(repository, workerData.id, {
        operation: "decrease",
        quantity: 4
      });
      parentPort.postMessage({ status: "updated", stock: product.stock });
    } catch (error) {
      parentPort.postMessage({ status: error.code || "error" });
    } finally {
      database.close();
    }
  `;

  return new Promise((resolve, reject) => {
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: {
        databasePath,
        databaseModule: require.resolve("../src/db"),
        repositoryModule: require.resolve(repositoryModule),
        serviceModule: require.resolve("../src/services/stock.service"),
        id,
      },
    });

    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker de ajuste terminó con código ${code}.`));
      }
    });
  });
}

test("aumenta 8 + 3 a 11 y luego disminuye 4 a 7", () => {
  withDatabase((database) => {
    const baseRepository = createRepository(database);
    const created = baseRepository.create(createInput());
    let calls = 0;
    const repository = {
      ...baseRepository,
      adjustStock(id, operation, quantity) {
        calls += 1;
        return baseRepository.adjustStock(id, operation, quantity);
      },
    };

    const increased = adjustStock(repository, created.id, {
      operation: "increase",
      quantity: 3,
    });
    assert.equal(increased.stock, 11);
    assert.equal(calls, 1);
    assert.equal(baseRepository.findById(created.id).stock, 11);

    const decreased = adjustStock(repository, created.id, {
      operation: "decrease",
      quantity: 4,
    });
    assert.equal(decreased.stock, 7);
    assert.equal(calls, 2);
    assert.equal(baseRepository.findById(created.id).stock, 7);
  });
});

test("rechaza un aumento que supera Number.MAX_SAFE_INTEGER sin alterar SQLite", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const created = repository.create(
      createInput({ stock: Number.MAX_SAFE_INTEGER }),
    );
    const stockBefore = database
      .prepare("SELECT CAST(stock AS TEXT) AS stock FROM products WHERE id = ?")
      .get(created.id).stock;

    assert.equal(stockBefore, String(Number.MAX_SAFE_INTEGER));
    assert.throws(() =>
      adjustStock(repository, created.id, {
        operation: "increase",
        quantity: 2,
      }),
    );

    const stockAfter = database
      .prepare("SELECT CAST(stock AS TEXT) AS stock FROM products WHERE id = ?")
      .get(created.id).stock;
    assert.equal(stockAfter, stockBefore);
  });
});

test("el repositorio distingue actualización, stock insuficiente e ID inexistente", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const created = repository.create(createInput({ stock: 7 }));

    const updated = repository.adjustStock(created.id, "decrease", 4);
    assert.equal(updated.status, "updated");
    assert.equal(updated.product.stock, 3);

    const insufficient = repository.adjustStock(created.id, "decrease", 4);
    assert.deepEqual(insufficient, { status: "insufficient_stock" });

    const notFound = repository.adjustStock(created.id + 999, "increase", 1);
    assert.deepEqual(notFound, { status: "not_found" });
    assert.equal(repository.findById(created.id).stock, 3);
  });
});

test("rechaza disminuir más de lo disponible y conserva el stock", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const created = repository.create(createInput({ stock: 7 }));

    assert.throws(
      () =>
        adjustStock(repository, created.id, {
          operation: "decrease",
          quantity: 8,
        }),
      { code: "INSUFFICIENT_STOCK" },
    );
    assert.equal(repository.findById(created.id).stock, 7);
  });
});

test("rechaza cantidades inválidas antes de llamar al repositorio", () => {
  withDatabase((database) => {
    const baseRepository = createRepository(database);
    const created = baseRepository.create(createInput());
    let calls = 0;
    const repository = {
      ...baseRepository,
      adjustStock(id, operation, quantity) {
        calls += 1;
        return baseRepository.adjustStock(id, operation, quantity);
      },
    };

    for (const quantity of [
      0,
      -1,
      1.5,
      "3",
      "no es número",
      Number.NaN,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      assertValidationError(() =>
        adjustStock(repository, created.id, { operation: "increase", quantity }),
      );
      assert.equal(calls, 0);
      assert.equal(baseRepository.findById(created.id).stock, 8);
    }
  });
});

test("rechaza operaciones distintas de increase y decrease sin llamar al repositorio", () => {
  withDatabase((database) => {
    const baseRepository = createRepository(database);
    const created = baseRepository.create(createInput());
    let calls = 0;
    const repository = {
      ...baseRepository,
      adjustStock(id, operation, quantity) {
        calls += 1;
        return baseRepository.adjustStock(id, operation, quantity);
      },
    };

    for (const operation of ["add", "Increase", "", null]) {
      assertValidationError(() =>
        adjustStock(repository, created.id, { operation, quantity: 1 }),
      );
    }
    assert.equal(calls, 0);
    assert.equal(baseRepository.findById(created.id).stock, 8);
  });
});

test("un ID inexistente se devuelve explícitamente sin modificar otros productos", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const existing = repository.create(createInput({ stock: 6 }));

    assert.deepEqual(
      adjustStock(repository, existing.id + 999, {
        operation: "increase",
        quantity: 2,
      }),
      { status: "not_found" },
    );
    assert.equal(repository.findById(existing.id).stock, 6);
    assert.equal(repository.findAll().length, 1);
  });
});

test("dos disminuciones concurrentes no confirman más unidades que las disponibles", async () => {
  const databasePath = createDatabasePath();
  let database;

  try {
    database = openDatabase(databasePath);
    const repository = createRepository(database);
    const created = repository.create(createInput({ stock: 5 }));
    database.close();
    database = null;

    const results = await Promise.all([
      runConcurrentAdjustment(databasePath, created.id),
      runConcurrentAdjustment(databasePath, created.id),
    ]);

    database = openDatabase(databasePath);
    const stored = createRepository(database).findById(created.id);
    assert.equal(results.filter((result) => result.status === "updated").length, 1);
    assert.equal(
      results.filter((result) => result.status === "INSUFFICIENT_STOCK").length,
      1,
    );
    assert.equal(stored.stock, 1);
    assert.ok(stored.stock >= 0);
  } finally {
    if (database) {
      database.close();
    }
    removeDatabaseFiles(databasePath);
  }
});

test("propaga sin reemplazar errores inesperados del repositorio", () => {
  const repositoryError = new Error("fallo simulado del repositorio");
  const repository = {
    adjustStock() {
      throw repositoryError;
    },
  };

  assert.throws(
    () =>
      adjustStock(repository, 1, {
        operation: "increase",
        quantity: 1,
      }),
    (error) => error === repositoryError,
  );
});
