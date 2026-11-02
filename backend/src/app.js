const express = require("express");
const productsRepository = require("./repositories/products.repository");
const {
  createProduct: createProductService,
  deleteProduct: deleteProductService,
  getProduct,
  listProducts,
  updateProduct: updateProductService,
  validateProductId,
  ValidationError,
} = require("./services/products.service");
const {
  adjustStock: adjustStockService,
  StockAdjustmentError,
} = require("./services/stock.service");
const summaryRepository = require("./repositories/summary.repository");
const { getSummary: getSummaryService } = require("./services/summary.service");
const { createProductsRouter } = require("./routes/products.routes");
const { createSummaryRouter } = require("./routes/summary.routes");
const budgetsRepository = require("./repositories/budgets.repository");
const {
  createBudget: createBudgetService,
  listBudgets: listBudgetsService,
  getBudget: getBudgetService,
  resolveBudget: resolveBudgetService,
} = require("./services/budgets.service");
const { createBudgetsRouter } = require("./routes/budgets.routes");

function createProductsService(database) {
  const repository = {
    findAll(filters) {
      return productsRepository.findAll(database, filters);
    },
    findById(id) {
      return productsRepository.findById(database, id);
    },
    create(product) {
      return productsRepository.create(database, product);
    },
    update(id, fields) {
      return productsRepository.update(database, id, fields);
    },
    deleteById(id) {
      return productsRepository.deleteById(database, id);
    },
    adjustStock(id, operation, quantity) {
      return productsRepository.adjustStock(database, id, operation, quantity);
    },
  };

  return {
    createProduct(input) {
      return createProductService(repository, input);
    },
    listProducts(filters) {
      return listProducts(repository, filters);
    },
    findProduct(id) {
      return getProduct(repository, id);
    },
    updateProduct(id, input) {
      return updateProductService(repository, id, input);
    },
    deleteProduct(id) {
      return deleteProductService(repository, id);
    },
    adjustStock(id, input) {
      return adjustStockService(repository, validateProductId(id), input);
    },
  };
}

function createBudgetsService(database) {
  const repository = {
    createBudget(items) {
      return budgetsRepository.createBudget(database, items);
    },
    listBudgets() {
      return budgetsRepository.listBudgets(database);
    },
    getBudget(id) {
      return budgetsRepository.getBudget(database, id);
    },
    resolveBudget(id, status) {
      return budgetsRepository.resolveBudget(database, id, status);
    },
  };

  return {
    createBudget(input) {
      return createBudgetService(repository, input);
    },
    listBudgets() {
      return listBudgetsService(repository);
    },
    getBudget(id) {
      return getBudgetService(repository, id);
    },
    resolveBudget(id, input) {
      return resolveBudgetService(repository, id, input);
    },
  };
}

function createSummaryService(database) {
  const repository = {
    getSummary() {
      return summaryRepository.getSummary(database);
    },
  };

  return {
    getSummary() {
      return getSummaryService(repository);
    },
  };
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  const isInvalidStockAdjustment =
    error instanceof StockAdjustmentError &&
    ["VALIDATION_ERROR", "INSUFFICIENT_STOCK"].includes(error.code);
  const isInvalidJson = error.type === "entity.parse.failed";
  const isPayloadTooLarge = error.type === "entity.too.large";
  const isDomainConflict = Number.isInteger(error.statusCode) &&
    typeof error.code === "string" && error.statusCode >= 400 && error.statusCode < 500;

  if (error instanceof ValidationError || isInvalidStockAdjustment || isInvalidJson) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: isInvalidJson
          ? "El cuerpo de la solicitud debe contener JSON válido."
          : error.message,
      },
    });
    return;
  }

  if (isDomainConflict) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  if (isPayloadTooLarge) {
    response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "La solicitud es demasiado grande. Reducí los datos e intentá nuevamente.",
      },
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error interno del servidor.",
    },
  });
}

function createApp({ database, productsService } = {}) {
  if (!database && !productsService) {
    throw new TypeError("createApp requiere una conexión a la base de datos o un productsService.");
  }

  const service = productsService || createProductsService(database);
  const app = express();

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    if (request.path === "/api" || request.path.startsWith("/api/")) {
      response.setHeader("Cache-Control", "no-store");
    }
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.use("/api/products", createProductsRouter(service));
  if (database) {
    app.use("/api/summary", createSummaryRouter(createSummaryService(database)));
    app.use("/api/budgets", createBudgetsRouter(createBudgetsService(database)));
  }
  app.use("/api", (request, response) => {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "El recurso de API solicitado no existe.",
      },
    });
  });
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, createProductsService, errorHandler };
