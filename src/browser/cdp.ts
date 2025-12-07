import CDP from 'chrome-remote-interface';
import type { BrowserError, ConsoleError, NetworkError } from '../error/types.js';

export interface CDPClient {
  navigate(url: string): Promise<void>;
  captureErrors(): Promise<BrowserError[]>;
  evaluate(script: string): Promise<unknown>;
  close(): Promise<void>;
}

export class CDPController implements CDPClient {
  private client: CDP.Client | null = null;
  private target: CDP.Target | null = null;
  private errors: (ConsoleError | NetworkError | BrowserError)[] = [];

  async connect(port: number = 9222): Promise<void> {
    try {
      const targets = await CDP.List({ port });
      const pageTarget = targets.find(
        (target) => target.type === 'page' && target.url !== 'about:blank'
      ) || targets[0];

      if (!pageTarget) {
        throw new Error('No page target found');
      }

      this.target = pageTarget;
      this.client = await CDP({ target: pageTarget });

      await this.setupErrorHandling();
    } catch (error) {
      throw new Error(`Failed to connect to CDP: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async setupErrorHandling(): Promise<void> {
    if (!this.client) return;

    const { Runtime, Log, Network, Page } = this.client;

    await Runtime.enable();
    await Log.enable();
    await Network.enable();
    await Page.enable();

    Runtime.exceptionThrown((params) => {
      this.errors.push({
        type: 'console',
        message: params.exceptionDetails.exception?.description || params.exceptionDetails.text || 'Unknown error',
        stack: params.exceptionDetails.stackTrace?.callFrames
          ?.map((frame) => `${frame.functionName}@${frame.url}:${frame.lineNumber}:${frame.columnNumber}`)
          .join('\n'),
        source: params.exceptionDetails.url,
        line: params.exceptionDetails.lineNumber,
        column: params.exceptionDetails.columnNumber,
        timestamp: Date.now(),
      });
    });

    Log.entryAdded((params) => {
      if (params.entry.level === 'error' || params.entry.level === 'warning') {
        const error: ConsoleError = {
          type: 'console',
          message: params.entry.text || 'Unknown log entry',
          level: params.entry.level === 'error' ? 'error' : 'warning',
          source: params.entry.url,
          line: params.entry.lineNumber,
          timestamp: params.entry.timestamp,
        };
        this.errors.push(error);
      }
    });

    Network.responseReceived((params) => {
      const response = params.response;
      if (response.status >= 400) {
        const error: NetworkError = {
          type: 'network',
          message: `Network error: ${response.status} ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
          method: response.requestHeaders?.['method'] || 'GET',
          requestUrl: response.url,
          timestamp: Date.now(),
        };
        this.errors.push(error);
      }
    });

    Network.loadingFailed((params) => {
      const error: NetworkError = {
        type: 'network',
        message: `Network request failed: ${params.errorText}`,
        requestUrl: params.requestId,
        timestamp: Date.now(),
        context: {
          errorText: params.errorText,
          type: params.type,
        },
      };
      this.errors.push(error);
    });
  }

  async navigate(url: string): Promise<void> {
    if (!this.client) {
      throw new Error('CDP client not connected');
    }

    this.errors = [];
    await this.client.Page.navigate({ url });
    await this.client.Page.loadEventFired();
  }

  async captureErrors(): Promise<BrowserError[]> {
    const currentErrors = [...this.errors];
    this.errors = [];
    return currentErrors;
  }

  async evaluate(script: string): Promise<unknown> {
    if (!this.client) {
      throw new Error('CDP client not connected');
    }

    const result = await this.client.Runtime.evaluate({ expression: script });
    return result.result?.value;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

