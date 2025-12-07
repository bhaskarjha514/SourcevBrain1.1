import { CDPController, type CDPClient } from './cdp.js';
import { PlaywrightController, type PlaywrightClient } from './playwright.js';
import { loadConfig } from '../utils/config.js';
import type { BrowserError } from '../error/types.js';

export interface BrowserController {
  initialize(): Promise<void>;
  navigate(url: string): Promise<void>;
  captureErrors(): Promise<BrowserError[]>;
  evaluate(script: string): Promise<unknown>;
  close(): Promise<void>;
  getPage(): unknown;
}

export class BrowserControllerImpl implements BrowserController {
  private cdpClient: CDPClient | null = null;
  private playwrightClient: PlaywrightClient | null = null;
  private useCDP: boolean = true;
  private config = loadConfig();

  async initialize(): Promise<void> {
    try {
      const cdp = new CDPController();
      await cdp.connect();
      this.cdpClient = cdp;
      this.useCDP = true;
    } catch (error) {
      console.warn('CDP connection failed, falling back to Playwright:', error);
      const playwright = new PlaywrightController();
      await playwright.launch(this.config.browser.headless);
      this.playwrightClient = playwright;
      this.useCDP = false;
    }
  }

  async navigate(url: string): Promise<void> {
    if (this.useCDP && this.cdpClient) {
      await this.cdpClient.navigate(url);
    } else if (this.playwrightClient) {
      await this.playwrightClient.navigate(url);
    } else {
      throw new Error('Browser not initialized');
    }
  }

  async captureErrors(): Promise<BrowserError[]> {
    if (this.useCDP && this.cdpClient) {
      return await this.cdpClient.captureErrors();
    } else if (this.playwrightClient) {
      return await this.playwrightClient.captureErrors();
    }
    return [];
  }

  async evaluate(script: string): Promise<unknown> {
    if (this.useCDP && this.cdpClient) {
      return await this.cdpClient.evaluate(script);
    } else if (this.playwrightClient) {
      return await this.playwrightClient.evaluate(script);
    }
    throw new Error('Browser not initialized');
  }

  getPage(): unknown {
    if (this.playwrightClient) {
      return this.playwrightClient.getPage();
    }
    return null;
  }

  async close(): Promise<void> {
    if (this.cdpClient) {
      await this.cdpClient.close();
      this.cdpClient = null;
    }
    if (this.playwrightClient) {
      await this.playwrightClient.close();
      this.playwrightClient = null;
    }
  }
}

