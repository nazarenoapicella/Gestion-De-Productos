const express = require("express");
const { createSummaryController } = require("../controllers/summary.controller");

function createSummaryRouter(summaryService) {
  const router = express.Router();
  const controller = createSummaryController(summaryService);

  router.get("/", controller.getSummary);

  return router;
}

module.exports = { createSummaryRouter };
