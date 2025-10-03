import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";
import type { TestCase, TestResult, TestSuiteResult } from "../types/index.js";

/**
 * Test Executor - Makes actual HTTP requests and validates responses
 *
 * Features:
 * - Executes HTTP tests with timeout handling
 * - Validates status codes and response bodies
 * - Captures detailed metrics (duration, status, etc.)
 * - Handles errors gracefully
 * - Supports parallel execution
 */

export class TestExecutor {
  private defaultTimeout: number;
  private maxConcurrent: number;

  constructor() {
    this.defaultTimeout = 10000; //* 10 seconds
    this.maxConcurrent = 10; //* Max parallel requests
  }

  //* Execute a single test case
  async runTest(test: TestCase, containerId: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      console.log(`🧪 Running test: ${test.name}`);

      //* Build request config
      const config: AxiosRequestConfig = {
        method: test.method,
        url: test.url,
        headers: test.headers || {},
        params: test.queryParams,
        data: test.body,
        timeout: test.timeout || this.defaultTimeout,
        validateStatus: () => true, //* Don't throw on any status code
        maxRedirects: 5,
      };

      //* Make HTTP request
      const response = await axios(config);
      const duration = Date.now() - startTime;

      //* Validate response
      const passed = this.validateResponse(response, test);

      const result: TestResult = {
        testId: test.id,
        testName: test.name,
        passed,
        status: response.status,
        duration,
        response: response.data,
        timestamp: Date.now(),
        containerId,
        endpoint: test.endpoint,
      };

      if (!passed) {
        result.error = this.generateErrorMessage(response, test);
      }

      console.log(
        `${passed ? "✅" : "❌"} Test ${passed ? "passed" : "failed"}: ${
          test.name
        } (${duration}ms)`
      );

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.error(`❌ Test error: ${test.name} - ${error.message}`);

      return {
        testId: test.id,
        testName: test.name,
        passed: false,
        duration,
        error: this.formatError(error),
        timestamp: Date.now(),
        containerId,
        endpoint: test.endpoint,
      };
    }
  }

  //* Execute multiple tests in sequence
  async runTestSuite(
    tests: TestCase[],
    containerId: string
  ): Promise<TestSuiteResult> {
    console.log(`🧪 Running test suite: ${tests.length} tests`);

    const startTime = Date.now();
    const results: TestResult[] = [];

    for (const test of tests) {
      const result = await this.runTest(test, containerId);
      results.push(result);
    }

    const endTime = Date.now();

    const suiteResult: TestSuiteResult = {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      avgDuration:
        results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      totalDuration: endTime - startTime,
      results,
      startTime,
      endTime,
    };

    console.log(`✅ Test suite complete:`);
    console.log(`   - Total: ${suiteResult.total}`);
    console.log(`   - Passed: ${suiteResult.passed}`);
    console.log(`   - Failed: ${suiteResult.failed}`);
    console.log(`   - Duration: ${suiteResult.totalDuration}ms`);

    return suiteResult;
  }

  //* Execute tests in parallel (faster but more resource intensive)
  async runTestSuiteParallel(
    tests: TestCase[],
    containerId: string
  ): Promise<TestSuiteResult> {
    console.log(`🧪 Running test suite in parallel: ${tests.length} tests`);

    const startTime = Date.now();

    //* Run tests in batches to avoid overwhelming the API
    const results: TestResult[] = [];

    for (let i = 0; i < tests.length; i += this.maxConcurrent) {
      const batch = tests.slice(i, i + this.maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((test) => this.runTest(test, containerId))
      );
      results.push(...batchResults);

      console.log(
        `   Completed batch ${
          Math.floor(i / this.maxConcurrent) + 1
        }/${Math.ceil(tests.length / this.maxConcurrent)}`
      );
    }

    const endTime = Date.now();

    const suiteResult: TestSuiteResult = {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      avgDuration:
        results.reduce((sum, r) => sum + r.duration, 0) / results.length,
      totalDuration: endTime - startTime,
      results,
      startTime,
      endTime,
    };

    console.log(
      `✅ Parallel test suite complete in ${suiteResult.totalDuration}ms`
    );

    return suiteResult;
  }

  //* Validate response against expected criteria
  private validateResponse(response: AxiosResponse, test: TestCase): boolean {
    //* Validate status code
    if (!this.validateStatus(response.status, test.expectedStatus)) {
      return false;
    }

    //* Validate response body if specified
    if (test.expectedResponse) {
      if (!this.validateResponseBody(response.data, test.expectedResponse)) {
        return false;
      }
    }

    //* Run custom assertions if provided
    if (test.assertions && test.assertions.length > 0) {
      return this.runAssertions(response, test.assertions);
    }

    return true;
  }

  //* Validate status code
  private validateStatus(
    actualStatus: number,
    expectedStatus: number | number[]
  ): boolean {
    if (Array.isArray(expectedStatus)) {
      return expectedStatus.includes(actualStatus);
    }
    return actualStatus === expectedStatus;
  }

  //* Validate response body structure
  private validateResponseBody(actual: any, expected: any): boolean {
    //* Simple validation - check if expected fields exist
    if (typeof expected === "object" && expected !== null) {
      for (const key in expected) {
        if (!(key in actual)) {
          return false;
        }
      }
    }
    return true;
  }

  //* Run custom assertions
  private runAssertions(
    response: AxiosResponse,
    assertions: string[]
  ): boolean {
    //* In a real implementation, you'd parse and evaluate these assertions
    //* For now, we'll just return true
    //* Example assertions: ["status === 200", "body.id !== null", "headers['content-type'].includes('json')"]
    return true;
  }

  //* Generate error message for failed test
  private generateErrorMessage(
    response: AxiosResponse,
    test: TestCase
  ): string {
    const messages: string[] = [];

    //* Status code mismatch
    const expectedStatuses = Array.isArray(test.expectedStatus)
      ? test.expectedStatus
      : [test.expectedStatus];

    if (!expectedStatuses.includes(response.status)) {
      messages.push(
        `Expected status ${expectedStatuses.join(" or ")}, got ${
          response.status
        }`
      );
    }

    //* Add response data if it's an error
    if (response.status >= 400) {
      const errorData =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data).substring(0, 200);
      messages.push(`Response: ${errorData}`);
    }

    return messages.join(". ");
  }

  //* Format error object into readable string
  private formatError(error: any): string {
    if (error.code === "ECONNREFUSED") {
      return "Connection refused - API server not accessible";
    }

    if (error.code === "ETIMEDOUT" || error.message.includes("timeout")) {
      return "Request timeout - API took too long to respond";
    }

    if (error.response) {
      return `HTTP ${error.response.status}: ${error.response.statusText}`;
    }

    return error.message || "Unknown error occurred";
  }

  //* Get test execution statistics
  getStatistics(results: TestResult[]): {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    totalDuration: number;
  } {
    const durations = results.map((r) => r.duration);

    return {
      totalTests: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      successRate:
        (results.filter((r) => r.passed).length / results.length) * 100,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      totalDuration: durations.reduce((a, b) => a + b, 0),
    };
  }

  //* Filter tests by category
  filterByCategory(tests: TestCase[], category: string): TestCase[] {
    return tests.filter((t) => t.category === category);
  }

  //* Filter failed tests from results
  getFailedTests(results: TestResult[]): TestResult[] {
    return results.filter((r) => !r.passed);
  }

  //* Get slowest tests
  getSlowestTests(results: TestResult[], limit: number = 10): TestResult[] {
    return [...results].sort((a, b) => b.duration - a.duration).slice(0, limit);
  }

  //* Set default timeout for all tests
  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  //* Set max concurrent requests
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
  }
}

//* Singleton instance
export const testExecutor = new TestExecutor();
