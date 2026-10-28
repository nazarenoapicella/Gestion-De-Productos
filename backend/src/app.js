const express = require("express");
const productsRepository = require("./repositories/products.repository");
const {
  createProduct: createProductService,
  getProduct,
  listProducts,
  ValidationError,
} = require("./services/products.service");
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
  };
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ValidationError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: error.message,
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
