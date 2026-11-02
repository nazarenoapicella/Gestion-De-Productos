const { createBudgetPdf } = require("../utils/budget-pdf");

function formatPrice(cents) {
  const value = BigInt(cents);
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

function toBudgetDto(budget) {
  return {
    id: budget.id,
    status: budget.status,
    total: formatPrice(budget.total_cents),
    createdAt: budget.created_at,
    resolvedAt: budget.resolved_at,
    items: budget.items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      unitPrice: formatPrice(item.unit_price_cents),
      lineTotal: formatPrice(item.line_total_cents),
    })),
  };
}

function createBudgetsController(budgetsService) {
  function create(request, response, next) {
    try {
      response.status(201).json(toBudgetDto(budgetsService.createBudget(request.body)));
    } catch (error) {
      next(error);
    }
  }

  function list(request, response, next) {
    try {
      response.json(budgetsService.listBudgets().map(toBudgetDto));
    } catch (error) {
      next(error);
    }
  }

  function get(request, response, next) {
    try {
      const budget = budgetsService.getBudget(request.params.id);
      if (!budget) {
        response.status(404).json({
          error: { code: "NOT_FOUND", message: "No se encontró el presupuesto solicitado." },
        });
        return;
      }
      response.json(toBudgetDto(budget));
    } catch (error) {
      next(error);
    }
  }

  function resolve(request, response, next) {
    try {
      response.json(toBudgetDto(budgetsService.resolveBudget(request.params.id, request.body)));
    } catch (error) {
      next(error);
    }
  }

  function pdf(request, response, next) {
    try {
      const budget = budgetsService.getBudget(request.params.id);
      if (!budget) {
        response.status(404).json({
          error: { code: "NOT_FOUND", message: "No se encontró el presupuesto solicitado." },
        });
        return;
      }
      const content = createBudgetPdf(budget);
      const filename = `presupuesto-${String(budget.id).padStart(5, "0")}.pdf`;
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader("Content-Length", content.length);
      response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      response.setHeader("Cache-Control", "no-store");
      response.end(content);
    } catch (error) {
      next(error);
    }
  }

  return { create, list, get, resolve, pdf };
}

module.exports = { createBudgetsController, toBudgetDto };
