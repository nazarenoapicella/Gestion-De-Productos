const express = require("express");
const { createProductsController } = require("../controllers/products.controller");

function createProductsRouter(productsService) {
  const router = express.Router();
  const controller = createProductsController(productsService);

  router.post("/", controller.createProduct);
  router.get("/", controller.listProducts);
  router.get("/:id", controller.getProduct);

  return router;
}

module.exports = { createProductsRouter };
