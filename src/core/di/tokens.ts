/**
 * Dependency Injection Tokens
 * Unique symbols for registering and resolving dependencies
 */

export const TOKENS = {
  databaseRepository: Symbol('databaseRepository'),
  wbApiClient: Symbol('wbApiClient'),
  dataLoadingService: Symbol('dataLoadingService'),
  reportAggregationService: Symbol('reportAggregationService'),
  supplyService: Symbol('supplyService'),
} as const
