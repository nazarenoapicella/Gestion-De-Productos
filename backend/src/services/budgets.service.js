const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

class BudgetError extends Error {
  constructor(message, code = "VALIDATION_ERROR", statusCode = 400) {
    super(message);
    this.name = "BudgetError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function validateBudgetId(value) {
  const text = String(value ?? "");
  if (!/^[1-9]\d*$/.test(text)) {
    throw new BudgetError("El identificador del presupuesto debe ser un entero positivo.");
  }
  const id = Number(text);
  if (!Number.isSafeInteger(id)) {
    throw new BudgetError("El identificador del presupuesto está fuera del rango admitido.");
  }
  return id;
}

function validateItems(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BudgetError("Los datos del presupuesto no son válidos.");
  }
  const unexpected = Object.keys(input).find((key) => key !== "items");
  if (unexpected) {
    throw new BudgetError(`El campo ${unexpected} no está permitido en esta operación.`);
  }
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) {
    throw new BudgetError("El presupuesto debe contener entre 1 y 50 productos.");
  }

  const seen = new Set();
  return input.items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new BudgetError(`El producto de la posición ${index + 1} no es válido.`);
    }
    const unexpectedField = Object.keys(item).find((key) => !["productId", "quantity"].includes(key));
    if (unexpectedField) {
      throw new BudgetError(`El campo ${unexpectedField} no está permitido en un producto del presupuesto.`);
    }
    const productId = item.productId;
    const quantity = item.quantity;
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      throw new BudgetError(`El producto de la posición ${index + 1} no tiene un identificador válido.`);
    }
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new BudgetError(`La cantidad del producto de la posición ${index + 1} debe ser un entero mayor que cero.`);
    }
    if (seen.has(productId)) {
      throw new BudgetError("No se puede agregar el mismo producto más de una vez. Modificá su cantidad en el detalle.");
    }
    seen.add(productId);
    return { productId, quantity };
  });
}

function createBudget(repository, input) {
  const items = validateItems(input);
  return repository.createBudget(items);
}

function listBudgets(repository) {
  return repository.listBudgets();
}

function getBudget(repository, value) {
  return repository.getBudget(validateBudgetId(value));
}

function resolveBudget(repository, idValue, input) {
  const id = validateBudgetId(idValue);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BudgetError("La resolución del presupuesto no es válida.");
  }
  const unexpected = Object.keys(input).find((key) => key !== "status");
  if (unexpected) throw new BudgetError(`El campo ${unexpected} no está permitido.`);
  if (! ["paid", "rejected"].includes(input.status)) {
    throw new BudgetError("Seleccioná si el presupuesto fue pagado o rechazado.");
  }
  return repository.resolveBudget(id, input.status);
}

module.exports = {
  BudgetError,
  createBudget,
  listBudgets,
  getBudget,
  resolveBudget,
};
