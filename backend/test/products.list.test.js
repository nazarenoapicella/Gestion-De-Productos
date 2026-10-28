const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const repositoryModule = "../src/repositories/products.repository";

function createDatabasePath() {
  return path.join(__dirname, `.t05-${process.pid}-${randomUUID()}.sqlite`);
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

function createRepository(database) {
  const repository = require(repositoryModule);
  return {
    create(product) {
      return repository.create(database, {
        description: null,
        price_cents: 0,
        stock: 0,
        ...product,
      });
    },
    findAll(filters) {
      return repository.findAll(database, filters);
    },
    count() {
      return database.prepare("SELECT COUNT(*) AS count FROM products").get().count;
    },
  };
}

function createFixture(repository) {
  repository.create({ name: "Mouse inalámbrico", category: "Periféricos" });
  repository.create({ name: "Teclado", category: "Periféricos" });
  repository.create({ name: "Mousepad", category: "Accesorios" });
}

function listProducts(repository, filters) {
  const { listProducts: list } = require("../src/services/products.service");
  return list(repository, filters);
}

test("sin filtros devuelve los tres productos por nombre ascendente", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    createFixture(repository);

    const products = listProducts(repository);

    assert.deepEqual(
      products.map((product) => product.name),
      ["Mouse inalámbrico", "Mousepad", "Teclado"],
    );
  });
});

test("recorta los espacios externos y busca parcialmente sin distinguir mayúsculas", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    createFixture(repository);

    const products = listProducts(repository, { search: "  mOuSe " });

    assert.deepEqual(
      products.map((product) => product.name),
      ["Mouse inalámbrico", "Mousepad"],
    );
  });
});

test("filtra por la categoría completa sin distinguir mayúsculas", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    createFixture(repository);

    const products = listProducts(repository, { category: "periféricos" });

    assert.deepEqual(
      products.map((product) => product.name),
      ["Mouse inalámbrico", "Teclado"],
    );
    assert.deepEqual(listProducts(repository, { category: "Peri" }), []);
  });
});

test("combina búsqueda y categoría con AND", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    createFixture(repository);

    const products = listProducts(repository, {
      search: "mouse",
      category: "Accesorios",
    });

    assert.deepEqual(
      products.map((product) => product.name),
      ["Mousepad"],
    );
  });
});

test("una búsqueda sin coincidencias devuelve una lista vacía", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    createFixture(repository);

    assert.deepEqual(listProducts(repository, { search: "router" }), []);
  });
});

test("la búsqueda no distingue mayúsculas en letras acentuadas", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    repository.create({ name: "Éxito", category: "Prueba" });

    assert.deepEqual(
      listProducts(repository, { search: "éxito" }).map((product) => product.name),
      ["Éxito"],
    );
  });
});

test("el filtro de categoría no distingue mayúsculas en letras acentuadas", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    repository.create({ name: "Producto", category: "Éxito" });

    assert.deepEqual(
      listProducts(repository, { category: "éxito" }).map((product) => product.name),
      ["Producto"],
    );
  });
});

test("una búsqueda vacía y sin categoría devuelve todos los productos", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    createFixture(repository);

    const products = listProducts(repository, {
      search: "   ",
      category: "",
    });

    assert.deepEqual(
      products.map((product) => product.name),
      ["Mouse inalámbrico", "Mousepad", "Teclado"],
    );
  });
});

test("normaliza los filtros, omite los vacíos y pasa solo los filtros presentes", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    createFixture(repository);
    const receivedFilters = [];
    const observingRepository = {
      findAll(filters) {
        receivedFilters.push(filters);
        return repository.findAll(filters);
      },
    };

    listProducts(observingRepository, {
      search: "  mouse ",
      category: " Accesorios  ",
    });
    listProducts(observingRepository, { search: "   ", category: "" });

    assert.deepEqual(receivedFilters, [
      { search: "mouse", category: "Accesorios" },
      {},
    ]);
  });
});

test("una base vacía devuelve una lista vacía", () => {
  withDatabase((database) => {
    const repository = createRepository(database);

    assert.deepEqual(listProducts(repository), []);
  });
});

test("el repository aplica el filtro de búsqueda y devuelve una lista vacía si no coincide", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    createFixture(repository);
    const { findAll } = require(repositoryModule);

    assert.deepEqual(findAll(database, { search: "router" }), []);
  });
});

test("nombres duplicados permanecen separados y desempatan por id ascendente", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const first = repository.create({
      name: "Mouse",
      category: "Periféricos",
    });
    const second = repository.create({
      name: "Mouse",
      category: "Accesorios",
    });
    repository.create({ name: "Teclado", category: "Periféricos" });

    const products = listProducts(repository, { search: "mouse" });

    assert.deepEqual(
      products.map((product) => product.id),
      [first.id, second.id],
    );
    assert.notEqual(products[0].id, products[1].id);
  });
});

test("un término con apariencia de SQL se trata literalmente y no altera los datos", () => {
  withDatabase((database) => {
    const repository = createRepository(database);
    const term = "Mouse'); DROP TABLE products; --";
    const matching = repository.create({
      name: term,
      category: "Prueba",
    });
    repository.create({ name: "Teclado", category: "Periféricos" });
    const before = repository.findAll();
    const countBefore = repository.count();

    const products = listProducts(repository, { search: term });

    assert.deepEqual(
      products.map((product) => product.id),
      [matching.id],
    );
    assert.equal(repository.count(), countBefore);
    assert.deepEqual(repository.findAll(), before);
  });
});
