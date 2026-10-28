function createSummaryController(summaryService) {
  function getSummary(request, response, next) {
    try {
      response.json(summaryService.getSummary());
    } catch (error) {
      next(error);
    }
  }

  return { getSummary };
}

module.exports = { createSummaryController };
