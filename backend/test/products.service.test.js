const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const repositoryModule = "../src/repositories/products.repository";

// Service contract: repository.create(fields) and repository.update(id, fields)
// receive persistence fields (including price_cents). Service inputs use ARS
// in `price`; returned products retain the repository's persisted shape.
// Validation errors expose code === "VALIDATION_ERROR".
const { createProduct, updateProduct } = require("../src/services/products.service");

function createDatabasePath() {
  return path.join(__dirname, `.t03-${process.pid}-${randomUUID()}.sqlite`);
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

function createInput(overrides = {}) {
  return {
    name: "Mouse",
    description: "Mouse inalámbrico",
    category: "Periféricos",
    price: "1250.50",
    stock: 5,
    ...overrides,
  };
}

function createRepository(database) {
  const repository = require(repositoryModule);
  return {
    create(fields) {
      return repository.create(database, fields);
    },
    update(id, fields) {
      return repository.update(database, id, fields);
    },
    findById(id) {
      return repository.findById(database, id);
    },
    count() {
      return database.prepare("SELECT COUNT(*) AS count FROM products").get().count;
    },
  };
}

function createPersistedProduct(repository, overrides = {}) {
  return repository.create({
    name: "Mouse",
    description: "Mouse inalámbrico",
    category: "Periféricos",
    price_cents: 125050,
    stock: 5,
    ...overrides,
  });
}

function assertValidationError(action) {
  assert.throws(action, { code: "VALIDATION_ERROR" });
}

test("crear recorta nombre y categoría y devuelve los campos persistidos", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const created = createProduct(
      repository,
      createInput({ name: "  Mouse  ", category: " Periféricos " }),
    );

    assert.equal(created.name, "Mouse");
    assert.equal(created.category, "Periféricos");
    assert.equal(created.price_cents, 125050);
    assert.equal(created.stock, 5);
    assert.equal(created.description, "Mouse inalámbrico");
    assert.equal(repository.count(), 1);
  });
});

test("crear acepta precio cero y convierte ARS a centavos sin redondear", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const zero = createProduct(repository, createInput({ price: "0", stock: 0 }));
    const regular = createProduct(repository, createInput({ price: "1250.50" }));

    assert.equal(zero.price_cents, 0);
    assert.equal(zero.stock, 0);
    assert.equal(regular.price_cents, 125050);
    assert.equal(repository.count(), 2);
  });
});

const invalidCreateInputs = [
  ["nombre solo con espacios", { name: "   " }],
  ["categoría vacía", { category: "" }],
  ["precio negativo", { price: "-1" }],
  ["precio no numérico", { price: "abc" }],
  ["precio con más de dos decimales", { price: "1250.505" }],
  ["nombre de 101 caracteres", { name: "n".repeat(101) }],
  ["descripción de 501 caracteres", { description: "d".repeat(501) }],
  ["categoría de 51 caracteres", { category: "c".repeat(51) }],
  ["stock negativo", { stock: -1 }],
  ["stock decimal", { stock: 1.5 }],
  ["stock no numérico", { stock: "abc" }],
];

for (const [label, overrides] of invalidCreateInputs) {
  test(`crear rechaza ${label} sin insertar filas`, () => {
    withDatabase((database) => {
      const repository = createRepository(database);

      assertValidationError(() =>
        createProduct(repository, createInput(overrides)),
      );
      assert.equal(repository.count(), 0);
    });
  });
}

test("crear acepta los límites máximos de nombre, descripción y categoría", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const created = createProduct(
      repository,
      createInput({
        name: "n".repeat(100),
        description: "d".repeat(500),
        category: "c".repeat(50),
      }),
    );

    assert.equal(created.name.length, 100);
    assert.equal(created.description.length, 500);
    assert.equal(created.category.length, 50);
    assert.equal(repository.count(), 1);
  });
});

test("crear acepta el máximo de centavos seguros y rechaza el centavo siguiente antes del repositorio", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const maximum = createProduct(
      repository,
      createInput({ price: "90071992547409.91" }),
    );

    assert.equal(maximum.price_cents, Number.MAX_SAFE_INTEGER);
    assert.equal(repository.count(), 1);

    let createCalls = 0;
    const observedRepository = {
      create(fields) {
        createCalls += 1;
        return repository.create(fields);
      },
    };

    assertValidationError(() =>
      createProduct(
        observedRepository,
        createInput({ price: "90071992547409.92" }),
      ),
    );
    assert.equal(createCalls, 0);
    assert.equal(repository.count(), 1);
  });
});

test("descripción omitida, nula o vacía se persiste como NULL", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const { description: omittedDescription, ...withoutDescription } =
      createInput();

    const omitted = createProduct(repository, withoutDescription);
    const explicitNull = createProduct(
      repository,
      createInput({ description: null }),
    );
    const empty = createProduct(repository, createInput({ description: "" }));

    assert.equal(omitted.description, null);
    assert.equal(explicitNull.description, null);
    assert.equal(empty.description, null);
    assert.equal(repository.count(), 3);
  });
});

test("editar actualiza solo los campos editables y conserva stock aunque venga stock: 99", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const original = createPersistedProduct(repository);
    let updateFields;
    const observedRepository = {
      update(id, fields) {
        updateFields = fields;
        return repository.update(id, fields);
      },
    };

    const updated = updateProduct(
      observedRepository,
      original.id,
      createInput({
        name: "  Mouse Pro  ",
        description: "Versión actualizada",
        category: " Accesorios ",
        price: "1750.25",
        stock: 99,
      }),
    );

    assert.deepEqual(Object.keys(updateFields).sort(), [
      "category",
      "description",
      "name",
      "price_cents",
    ]);
    assert.equal(updated.name, "Mouse Pro");
    assert.equal(updated.description, "Versión actualizada");
    assert.equal(updated.category, "Accesorios");
    assert.equal(updated.price_cents, 175025);
    assert.equal(updated.stock, 5);
    assert.equal(repository.findById(original.id).stock, 5);
  });
});

const invalidUpdateInputs = [
  ["nombre solo con espacios", { name: "   " }],
  ["categoría vacía", { category: "" }],
  ["precio negativo", { price: "-1" }],
  ["precio no numérico", { price: "abc" }],
  ["precio con más de dos decimales", { price: "1250.505" }],
  ["nombre de 101 caracteres", { name: "n".repeat(101) }],
  ["descripción de 501 caracteres", { description: "d".repeat(501) }],
  ["categoría de 51 caracteres", { category: "c".repeat(51) }],
];

for (const [label, overrides] of invalidUpdateInputs) {
  test(`editar rechaza ${label} sin cambiar ningún campo previo`, () => {
    withDatabase((database) => {
      const repository = createRepository(database);
      const original = createPersistedProduct(repository);
      const proposed = createInput({
        name: "Cambio no persistible",
        description: "Tampoco debe persistirse",
        category: "Categoría cambiada",
        price: "999.99",
        ...overrides,
      });

      assertValidationError(() =>
        updateProduct(repository, original.id, proposed),
      );
      assert.deepEqual(repository.findById(original.id), original);
    });
  });
}

test("editar devuelve null para un ID inexistente y conserva los registros", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const original = createPersistedProduct(repository);
    const missingId = original.id + 999999;

    assert.equal(
      updateProduct(repository, missingId, createInput({ stock: 99 })),
      null,
    );
    assert.deepEqual(repository.findById(original.id), original);
    assert.equal(repository.findById(missingId), null);
    assert.equal(repository.count(), 1);
  });
});

test("los errores del repositorio se propagan sin convertirse en éxito", () => {
  const repositoryError = new Error("fallo simulado del repositorio");
  const repository = {
    create() {
      throw repositoryError;
    },
    update() {
      throw repositoryError;
    },
  };

  assert.throws(
    () => createProduct(repository, createInput()),
    (error) => error === repositoryError,
  );
  assert.throws(
    () => updateProduct(repository, 1, createInput()),
    (error) => error === repositoryError,
  );
});
