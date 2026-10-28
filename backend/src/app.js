const express = require("express");
const productsRepository = require("./repositories/products.repository");
const {
  createProduct: createProductService,
  deleteProduct: deleteProductService,
  getProduct,
  listProducts,
  updateProduct: updateProductService,
  ValidationError,
} = require("./services/products.service");
const {
  adjustStock: adjustStockService,
  StockAdjustmentError,
} = require("./services/stock.service");
const { createProductsRouter } = require("./routes/products.routes");

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
      return getProduct(repository, Number(id));
    },
    updateProduct(id, input) {
      return updateProductService(repository, Number(id), input);
    },
    deleteProduct(id) {
      return deleteProductService(repository, Number(id));
    },
    adjustStock(id, input) {
      return adjustStockService(repository, Number(id), input);
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

  if (
    error instanceof ValidationError ||
    isInvalidStockAdjustment ||
    isInvalidJson
  ) {
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

  console.error(error);
  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error interno del servidor.",
    },
  });
}

function createApp({ database, productsService } = {}) {
  const service = productsService || createProductsService(database);
  const app = express();

  app.use(express.json());
  app.use("/api/products", createProductsRouter(service));
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
