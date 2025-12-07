import { chromium, Browser, Page, BrowserContext } from 'playwright';
import type { BrowserError, ConsoleError, NetworkError } from '../error/types.js';

export interface PlaywrightClient {
  navigate(url: string): Promise<void>;
  captureErrors(): Promise<BrowserError[]>;
  evaluate(script: string): Promise<unknown>;
  close(): Promise<void>;
  getPage(): Page | null;
}

export class PlaywrightController implements PlaywrightClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private errors: (ConsoleError | NetworkError | BrowserError)[] = [];

  async launch(headless: boolean = true): Promise<void> {
    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    await this.setupErrorHandling();
  }

  private async setupErrorHandling(): Promise<void> {
    if (!this.page) return;

    this.page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        const error: ConsoleError = {
          type: 'console',
          message: msg.text(),
          level: type === 'error' ? 'error' : 'warning',
          timestamp: Date.now(),
        };
        this.errors.push(error);
      }
    });

    this.page.on('pageerror', (error) => {
      this.errors.push({
        type: 'console',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
      });
    });

    this.page.on('requestfailed', (request) => {
      const error: NetworkError = {
        type: 'network',
        message: `Network request failed: ${request.failure()?.errorText || 'Unknown error'}`,
        requestUrl: request.url(),
        method: request.method(),
        timestamp: Date.now(),
        context: {
          failure: request.failure(),
        },
      };
      this.errors.push(error);
    });

    this.page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        const error: NetworkError = {
          type: 'network',
          message: `Network error: ${status} ${response.statusText()}`,
          status,
          statusText: response.statusText(),
          method: response.request().method(),
          requestUrl: response.url(),
          timestamp: Date.now(),
        };
        this.errors.push(error);
      }
    });
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Playwright page not initialized');
    }

    this.errors = [];
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async captureErrors(): Promise<BrowserError[]> {
    if (!this.page) {
      return [];
    }

    const currentErrors = [...this.errors];
    this.errors = [];
    return currentErrors;
  }

  async evaluate(script: string): Promise<unknown> {
    if (!this.page) {
      throw new Error('Playwright page not initialized');
    }

    return await this.page.evaluate(script);
  }

  getPage(): Page | null {
    return this.page;
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.page = null;
  }
}

