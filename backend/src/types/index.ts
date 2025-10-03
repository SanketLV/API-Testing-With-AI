/**
 * Type Definitions for AI API Testing Suite
 * These types ensure type safety across the entire backend
 */

// ============================================
// API SPECIFICATION TYPES
// ============================================

export interface APISpecification {
  id?: string;
  title: string;
  version: string;
  baseUrl: string;
  description?: string;
  endpoints: Endpoint[];
  schemas: Record<string, Schema>;
  security?: SecurityScheme[];
}

export interface Endpoint {
  path: string;
  method: HTTPMethod;
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: SecurityRequirement[];
  tags?: string[];
}

export type HTTPMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export interface Parameter {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required: boolean;
  schema: Schema;
  example?: any;
}

export interface RequestBody {
  description?: string;
  required: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema: Schema;
  example?: any;
  examples?: Record<string, Example>;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, Header>;
}

export interface Schema {
  type?: string;
  format?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: any[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: any;
  example?: any;
  description?: string;
  nullable?: boolean;
  $ref?: string;
}

export interface Header {
  description?: string;
  schema: Schema;
  required?: boolean;
}

export interface Example {
  summary?: string;
  description?: string;
  value: any;
}

export interface SecurityScheme {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  scheme?: string;
  bearerFormat?: string;
  in?: "query" | "header" | "cookie";
  name?: string;
  description?: string;
}

export interface SecurityRequirement {
  [key: string]: string[];
}

// ============================================
// TEST TYPES
// ============================================

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: TestCategory;
  endpoint: string;
  path: string; // Add path property for backward compatibility
  method: HTTPMethod;
  url: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, any>;
  pathParams?: Record<string, any>;
  body?: any;
  expectedStatus: number | number[];
  expectedResponse?: any;
  assertions?: string[];
  timeout?: number;
  metadata?: Record<string, any>;
}

export type TestCategory =
  | "happy_path"
  | "edge_case"
  | "security"
  | "performance"
  | "error_handling"
  | "validation";

export interface TestResult {
  testId: string;
  testName: string;
  passed: boolean;
  status?: number;
  duration: number;
  response?: any;
  error?: string;
  timestamp: number;
  containerId?: string;
  endpoint?: string;
}

export interface TestSuiteResult {
  total: number;
  passed: number;
  failed: number;
  skipped?: number;
  avgDuration: number;
  totalDuration?: number;
  results: TestResult[];
  startTime?: number;
  endTime?: number;
}

// ============================================
// AI ANALYSIS TYPES
// ============================================

export interface AIAnalysis {
  summary: string;
  insights: Insight[];
  patterns?: string[];
  recommendations?: string[];
  criticalIssues?: CriticalIssue[];
  performanceInsights?: PerformanceInsight;
}

export interface Insight {
  testName: string;
  issue: string;
  cause: string;
  fix: string;
  severity: "critical" | "high" | "medium" | "low";
  affectedEndpoints?: string[];
  category?: string;
}

export interface CriticalIssue {
  title: string;
  description: string;
  solution: string;
  priority: number;
  impact: string;
}

export interface PerformanceInsight {
  avgResponseTime: number;
  p95: number;
  p99?: number;
  max: number;
  min?: number;
  slowestEndpoints?: Array<{
    endpoint: string;
    avgDuration: number;
  }>;
}

export interface Improvement {
  endpoint: string;
  category: "performance" | "security" | "error_handling" | "documentation";
  priority: "high" | "medium" | "low";
  issue: string;
  suggestion: string;
  impact: string;
}

// ============================================
// PERFORMANCE ANALYSIS TYPES
// ============================================

export interface PerformanceRegression {
  hasRegressions: boolean;
  baseline?: boolean;
  regressions?: RegressionDetail[];
  summary?: RegressionSummary;
}

export interface RegressionDetail {
  testId: string;
  testName: string;
  currentDuration: number;
  baselineDuration: number;
  percentageChange: string;
  severity: "critical" | "warning";
}

export interface RegressionSummary {
  overallChange: string;
  criticalRegressions: number;
  totalRegressions: number;
  recommendation: string;
}

export interface PerformanceBaseline {
  testId: string;
  name: string;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
}

// ============================================
// BREAKING CHANGE TYPES
// ============================================

export interface BreakingChangeAnalysis {
  removedEndpoints: BreakingChange[];
  modifiedEndpoints: ModifiedEndpoint[];
  newEndpoints: BreakingChange[];
  schemaChanges: SchemaChange[];
  aiAnalysis?: ChangeAnalysisAI;
  breakingScore: BreakingScore;
}

export interface BreakingChange {
  method: string;
  path: string;
  impact: "BREAKING" | "NON_BREAKING" | "POTENTIALLY_BREAKING";
  reason: string;
}

export interface ModifiedEndpoint {
  method: string;
  path: string;
  changes: EndpointChange[];
}

export interface EndpointChange {
  type: string;
  impact: "BREAKING" | "NON_BREAKING" | "POTENTIALLY_BREAKING";
  parameter?: string;
  reason: string;
  field?: string;
}

export interface SchemaChange {
  schema: string;
  changeType:
    | "REMOVED_FIELD"
    | "CHANGED_TYPE"
    | "NEW_REQUIRED_FIELD"
    | "NEW_OPTIONAL_FIELD";
  field: string;
  impact: "BREAKING" | "NON_BREAKING";
  oldValue?: any;
  newValue?: any;
}

export interface ChangeAnalysisAI {
  migrationStrategy: string;
  affectedClients: string[];
  rollbackPlan: string;
  communicationPlan: string;
}

export interface BreakingScore {
  score: number;
  severity: "SAFE" | "LOW" | "MEDIUM" | "HIGH";
}

// ============================================
// LOAD TESTING TYPES
// ============================================

export interface LoadTestConfig {
  concurrency: number;
  duration: number; // seconds
  rampUp?: boolean;
  requestsPerSecond?: number;
}

export interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: string;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  requestsPerSecond: string;
  errorRate: string;
}

export interface LoadTestPrediction {
  tests: Array<{
    load: number;
    successRate: string;
    avgResponseTime: number;
    errorRate: string;
  }>;
  predictedFailureLoad: number;
  recommendation: string;
}

// ============================================
// DOCKER TYPES
// ============================================

export interface DockerContainer {
  id: string;
  name?: string;
  status: "created" | "running" | "stopped" | "removed";
  created: number;
  image?: string;
}

export interface ContainerConfig {
  image: string;
  env?: string[];
  memory?: number;
  cpus?: number;
  timeout?: number;
}

// ============================================
// WEBSOCKET MESSAGE TYPES
// ============================================

export interface WSMessage {
  type: WSMessageType;
  data?: any;
  timestamp?: string;
}

export type WSMessageType =
  | "connected"
  | "start_tests"
  | "stop_tests"
  | "test_suite_started"
  | "container_created"
  | "test_start"
  | "test_complete"
  | "test_completed"
  | "all_complete"
  | "tests_stopped"
  | "error"
  | "ping"
  | "pong";

export interface TestProgressMessage {
  type: "test_start" | "test_complete";
  test?: {
    id: string;
    name: string;
    description: string;
    endpoint: string;
  };
  result?: TestResult;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  summary?: {
    passed: number;
    failed: number;
  };
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
  timestamp: string;
  stack?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
