const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { existsSync, unlinkSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { openDatabase } = require("../src/db");
const productsRepository = require("../src/repositories/products.repository");
const budgetsRepository = require("../src/repositories/budgets.repository");
const budgetsService = require("../src/services/budgets.service");

function createDatabasePath() {
  return path.join(__dirname, `.budgets-service-${process.pid}-${randomUUID()}.sqlite`);
}

function removeDatabaseFiles(databasePath) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    const filePath = `${databasePath}${suffix}`;
    if (existsSync(filePath)) unlinkSync(filePath);
  }
}

function withDatabase(callback) {
  const databasePath = createDatabasePath();
  let database;
  try {
    database = openDatabase(databasePath);
    const repository = {
      createBudget: (items) => budgetsRepository.createBudget(database, items),
      getBudget: (id) => budgetsRepository.getBudget(database, id),
      listBudgets: () => budgetsRepository.listBudgets(database),
      resolveBudget: (id, status) => budgetsRepository.resolveBudget(database, id, status),
    };
    callback(database, repository);
  } finally {
    if (database) database.close();
    removeDatabaseFiles(databasePath);
  }
}

function addProduct(database, name, priceCents, stock) {
  return productsRepository.create(database, {
    name,
    description: null,
    category: "Prueba",
    price_cents: priceCents,
    stock,
  });
}

test("crea presupuesto con precios históricos y reserva stock", () => {
  withDatabase((database, repository) => {
    const product = addProduct(database, "Monitor", 150099, 8);
    const budget = budgetsService.createBudget(repository, {
      items: [{ productId: product.id, quantity: 3 }],
    });
    assert.equal(budget.status, "pending");
    assert.equal(budget.total_cents, 450297);
    assert.equal(budget.items[0].product_name, "Monitor");
    assert.equal(budget.items[0].unit_price_cents, 150099);
    assert.equal(productsRepository.findById(database, product.id).stock, 5);
  });
});

test("rechazar restaura stock una sola vez; pagado no lo restaura", () => {
  withDatabase((database, repository) => {
    const rejectedProduct = addProduct(database, "Producto A", 2500, 10);
    const rejected = budgetsService.createBudget(repository, {
      items: [{ productId: rejectedProduct.id, quantity: 4 }],
    });
    assert.equal(productsRepository.findById(database, rejectedProduct.id).stock, 6);
    budgetsService.resolveBudget(repository, rejected.id, { status: "rejected" });
    assert.equal(productsRepository.findById(database, rejectedProduct.id).stock, 10);
    assert.throws(
      () => budgetsService.resolveBudget(repository, rejected.id, { status: "rejected" }),
      (error) => error.code === "BUDGET_ALREADY_RESOLVED",
    );
    assert.equal(productsRepository.findById(database, rejectedProduct.id).stock, 10);

    const paidProduct = addProduct(database, "Producto B", 9900, 10);
    const paid = budgetsService.createBudget(repository, {
      items: [{ productId: paidProduct.id, quantity: 7 }],
    });
    budgetsService.resolveBudget(repository, paid.id, { status: "paid" });
    assert.equal(productsRepository.findById(database, paidProduct.id).stock, 3);
    assert.equal(repository.getBudget(paid.id).status, "paid");
  });
});

test("una línea con stock insuficiente cancela toda la transacción", () => {
  withDatabase((database, repository) => {
    const first = addProduct(database, "Producto suficiente", 1000, 10);
    const second = addProduct(database, "Producto sin stock", 2000, 1);
    assert.throws(
      () => budgetsService.createBudget(repository, {
        items: [
          { productId: first.id, quantity: 5 },
          { productId: second.id, quantity: 2 },
        ],
      }),
      (error) => error.code === "INSUFFICIENT_STOCK",
    );
    assert.equal(productsRepository.findById(database, first.id).stock, 10);
    assert.equal(productsRepository.findById(database, second.id).stock, 1);
    assert.equal(repository.listBudgets().length, 0);
  });
});

test("valida cantidades, IDs, líneas duplicadas y estados", () => {
  withDatabase((database, repository) => {
    const product = addProduct(database, "Producto", 1000, 5);
    for (const items of [
      [],
      [{ productId: product.id, quantity: 0 }],
      [{ productId: product.id, quantity: -1 }],
      [{ productId: product.id, quantity: 1.5 }],
      [{ productId: "1", quantity: 1 }],
      [{ productId: product.id, quantity: 1 }, { productId: product.id, quantity: 1 }],
    ]) {
      assert.throws(() => budgetsService.createBudget(repository, { items }), /./);
    }
    assert.throws(() => budgetsService.resolveBudget(repository, 1, { status: "pending" }), /./);
    assert.equal(productsRepository.findById(database, product.id).stock, 5);
    assert.equal(repository.listBudgets().length, 0);
  });
});

test("impide borrar productos con reservas activas y permite hacerlo al resolver", () => {
  withDatabase((database, repository) => {
    const product = addProduct(database, "Producto reservado", 1000, 3);
    const budget = budgetsService.createBudget(repository, {
      items: [{ productId: product.id, quantity: 2 }],
    });
    assert.throws(
      () => productsRepository.deleteById(database, product.id),
      (error) => error.code === "PRODUCT_RESERVED",
    );
    budgetsService.resolveBudget(repository, budget.id, { status: "rejected" });
    assert.equal(productsRepository.deleteById(database, product.id), true);
  });
});
