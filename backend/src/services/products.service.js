const editableFields = ["name", "description", "category", "price"];
const creationFields = [...editableFields, "stock"];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.code = "VALIDATION_ERROR";
  }
}

function assertProductInput(input, fields) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("Los datos del producto no son válidos.");
  }

  for (const field of fields) {
    if (!Object.hasOwn(input, field)) {
      if (field === "description") {
        continue;
      }
      throw new ValidationError(`El campo ${field} es obligatorio.`);
    }
  }
}

function validateText(input, field, { required, maxLength }) {
  const value = input[field];
  if (value === undefined || value === null) {
    if (!required && value == null) {
      return null;
    }
    throw new ValidationError(`El campo ${field} debe ser texto.`);
  }

  if (typeof value !== "string") {
    throw new ValidationError(`El campo ${field} debe ser texto.`);
  }

  const normalized = field === "name" || field === "category" ? value.trim() : value;

  if (required && normalized.length === 0) {
    throw new ValidationError(`El campo ${field} es obligatorio.`);
  }
  if (normalized.length > maxLength) {
    throw new ValidationError(
      `El campo ${field} no puede superar ${maxLength} caracteres.`,
    );
  }

  return field === "description" && normalized.length === 0 ? null : normalized;
}

function priceToCents(price) {
  if (typeof price !== "string" || !/^-?\d+(?:\.\d{1,2})?$/.test(price)) {
    throw new ValidationError("El precio debe ser texto decimal con hasta dos cifras.");
  }

  if (price.startsWith("-")) {
    throw new ValidationError("El precio debe ser no negativo.");
  }

  const [whole, fraction = ""] = price.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new ValidationError("El precio está fuera del rango admitido.");
  }

  return Number(cents);
}

function validateProduct(input, fields) {
  assertProductInput(input, fields);

  const name = validateText(input, "name", { required: true, maxLength: 100 });
  const description = validateText(input, "description", {
    required: false,
    maxLength: 500,
  });
  const category = validateText(input, "category", {
    required: true,
    maxLength: 50,
  });
  const price_cents = priceToCents(input.price);

  const product = { name, description, category, price_cents };
  if (fields.includes("stock")) {
    if (!Number.isSafeInteger(input.stock) || input.stock < 0) {
      throw new ValidationError("El stock debe ser un entero no negativo.");
    }
    product.stock = input.stock;
  }

  return product;
}

function createProduct(repository, input) {
  const product = validateProduct(input, creationFields);
  return repository.create(product);
}

function updateProduct(repository, id, input) {
  const product = validateProduct(input, editableFields);
  return repository.update(id, product);
}

function normalizeListFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw new ValidationError("Los filtros de productos no son válidos.");
  }

  const normalized = {};
  for (const field of ["search", "category"]) {
    if (!Object.hasOwn(filters, field)) {
      continue;
    }

    if (typeof filters[field] !== "string") {
      throw new ValidationError(`El filtro ${field} debe ser texto.`);
    }

    const value = filters[field].trim();
    if (value) {
      normalized[field] = value;
    }
  }

  return normalized;
}

function listProducts(repository, filters = {}) {
  return repository.findAll(normalizeListFilters(filters));
}

module.exports = {
  createProduct,
  updateProduct,
  listProducts,
  ValidationError,
};
