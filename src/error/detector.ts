import type { BrowserError, ErrorCollection, ConsoleError, NetworkError, ReactError, UIError } from './types.js';
import type { BrowserController } from '../browser/controller.js';

export class ErrorDetector {
  private browser: BrowserController;

  constructor(browser: BrowserController) {
    this.browser = browser;
  }

  async detectAllErrors(): Promise<ErrorCollection> {
    const consoleErrors = await this.detectConsoleErrors();
    const networkErrors = await this.detectNetworkErrors();
    const reactErrors = await this.detectReactErrors();
    const uiErrors = await this.detectUIErrors();

    const allErrors = [
      ...consoleErrors,
      ...networkErrors,
      ...reactErrors,
      ...uiErrors,
    ];

    return {
      errors: allErrors,
      hasErrors: allErrors.length > 0,
      summary: this.generateSummary(allErrors),
    };
  }

  async detectConsoleErrors(): Promise<ConsoleError[]> {
    const errors = await this.browser.captureErrors();
    return errors.filter((e): e is ConsoleError => e.type === 'console');
  }

  async detectNetworkErrors(): Promise<NetworkError[]> {
    const errors = await this.browser.captureErrors();
    return errors.filter((e): e is NetworkError => e.type === 'network');
  }

  async detectReactErrors(): Promise<ReactError[]> {
    try {
      const reactErrorInfo = await this.browser.evaluate(`
        (function() {
          const errors = [];
          const errorBoundaries = document.querySelectorAll('[data-react-error-boundary]');
          errorBoundaries.forEach(boundary => {
            const errorText = boundary.textContent || '';
            if (errorText.includes('Error') || errorText.includes('Something went wrong')) {
              errors.push({
                type: 'react',
                message: errorText,
                errorBoundary: boundary.getAttribute('data-react-error-boundary'),
                timestamp: Date.now()
              });
            }
          });
          
          if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
            const devtools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
            if (devtools.renderers && devtools.renderers.size > 0) {
              devtools.renderers.forEach(renderer => {
                if (renderer.currentDispatcherRef && renderer.currentDispatcherRef.current) {
                  const dispatcher = renderer.currentDispatcherRef.current;
                  if (dispatcher.getCurrentFiber) {
                    try {
                      const fiber = dispatcher.getCurrentFiber();
                      if (fiber && fiber.memoizedState && fiber.memoizedState.error) {
                        errors.push({
                          type: 'react',
                          message: fiber.memoizedState.error.message || 'React component error',
                          componentStack: fiber.memoizedState.error.stack,
                          timestamp: Date.now()
                        });
                      }
                    } catch (e) {
                      // Ignore errors accessing React internals
                    }
                  }
                }
              });
            }
          }
          
          return errors;
        })()
      `) as ReactError[];

      return reactErrorInfo || [];
    } catch (error) {
      return [];
    }
  }

  async detectUIErrors(): Promise<UIError[]> {
    const errors = await this.browser.captureErrors();
    return errors.filter((e): e is UIError => e.type === 'ui');
  }

  private generateSummary(errors: BrowserError[]): string {
    if (errors.length === 0) {
      return 'No errors detected';
    }

    const byType = errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const summaryParts = Object.entries(byType).map(
      ([type, count]) => `${count} ${type} error${count > 1 ? 's' : ''}`
    );

    return `Found ${errors.length} error(s): ${summaryParts.join(', ')}`;
  }

  async waitForErrors(timeout: number = 5000): Promise<ErrorCollection> {
    const startTime = Date.now();
    let lastCollection: ErrorCollection = { errors: [], hasErrors: false, summary: 'No errors' };

    while (Date.now() - startTime < timeout) {
      const collection = await this.detectAllErrors();
      if (collection.hasErrors) {
        lastCollection = collection;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        break;
      }
    }

    return lastCollection;
  }
}

