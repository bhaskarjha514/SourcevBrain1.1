import type { BrowserController } from '../browser/controller.js';
import { ErrorDetector } from '../error/detector.js';
import { UIValidator, type UIValidationRule } from './validator.js';
import type { ErrorCollection } from '../error/types.js';
import { loadConfig } from '../utils/config.js';

export interface FeatureTest {
  name: string;
  url?: string;
  uiRules?: UIValidationRule[];
  waitTime?: number;
}

export interface TestResult {
  feature: string;
  success: boolean;
  errors: ErrorCollection;
  duration: number;
}

export class TestRunner {
  private browser: BrowserController;
  private errorDetector: ErrorDetector;
  private uiValidator: UIValidator;
  private config = loadConfig();

  constructor(browser: BrowserController) {
    this.browser = browser;
    this.errorDetector = new ErrorDetector(browser);
    this.uiValidator = new UIValidator(browser);
  }

  async testFeature(feature: FeatureTest): Promise<TestResult> {
    const startTime = Date.now();

    try {
      if (feature.url) {
        await this.browser.navigate(feature.url);
      }

      if (feature.waitTime) {
        await new Promise((resolve) => setTimeout(resolve, feature.waitTime));
      }

      const errors = await this.errorDetector.detectAllErrors();

      let uiValidationSuccess = true;
      if (feature.uiRules && feature.uiRules.length > 0) {
        const uiResult = await this.uiValidator.validateMultiple(feature.uiRules);
        uiValidationSuccess = uiResult.success;
        if (!uiResult.success) {
          errors.errors.push(...uiResult.errors);
          errors.hasErrors = true;
          errors.summary = `${errors.summary}. UI validation failed: ${uiResult.errors.length} error(s)`;
        }
      }

      const success = !errors.hasErrors && uiValidationSuccess;

      return {
        feature: feature.name,
        success,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        feature: feature.name,
        success: false,
        errors: {
          errors: [{
            type: 'console',
            message: error instanceof Error ? error.message : 'Unknown test error',
            timestamp: Date.now(),
          }],
          hasErrors: true,
          summary: `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        duration: Date.now() - startTime,
      };
    }
  }

  async testFeatureWithRetry(feature: FeatureTest, maxAttempts?: number): Promise<TestResult> {
    const attempts = maxAttempts || this.config.test.maxRetryAttempts;
    let lastResult: TestResult | null = null;

    for (let i = 0; i < attempts; i++) {
      lastResult = await this.testFeature(feature);
      if (lastResult.success) {
        return lastResult;
      }

      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return lastResult!;
  }

  async waitForStability(timeout: number = 3000): Promise<void> {
    const startTime = Date.now();
    let lastErrorCount = Infinity;

    while (Date.now() - startTime < timeout) {
      const errors = await this.errorDetector.detectAllErrors();
      const currentErrorCount = errors.errors.length;

      if (currentErrorCount === 0 || currentErrorCount === lastErrorCount) {
        break;
      }

      lastErrorCount = currentErrorCount;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

