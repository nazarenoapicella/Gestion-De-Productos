const express = require("express");
const { createBudgetsController } = require("../controllers/budgets.controller");

function createBudgetsRouter(budgetsService) {
  const router = express.Router();
  const controller = createBudgetsController(budgetsService);

  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:id/pdf", controller.pdf);
  router.patch("/:id/status", controller.resolve);
  router.get("/:id", controller.get);

  return router;
}

module.exports = { createBudgetsRouter };
