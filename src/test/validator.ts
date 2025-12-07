import type { BrowserController } from '../browser/controller.js';
import type { UIError } from '../error/types.js';

export interface UIValidationRule {
  selector: string;
  action?: 'click' | 'type' | 'wait' | 'check';
  value?: string;
  expected?: string;
  timeout?: number;
}

export class UIValidator {
  private browser: BrowserController;

  constructor(browser: BrowserController) {
    this.browser = browser;
  }

  async validateElement(selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      const exists = await this.browser.evaluate(`
        (function() {
          const element = document.querySelector('${selector}');
          return element !== null;
        })()
      `) as boolean;

      return exists;
    } catch {
      return false;
    }
  }

  async validateInteraction(rule: UIValidationRule): Promise<{ success: boolean; error?: UIError }> {
    try {
      const page = this.browser.getPage();
      if (!page) {
        return {
          success: false,
          error: {
            type: 'ui',
            message: 'Page not available for interaction',
            element: rule.selector,
            action: rule.action,
            timestamp: Date.now(),
          },
        };
      }

      const result = await this.browser.evaluate(`
        (function() {
          const element = document.querySelector('${rule.selector}');
          if (!element) {
            return { success: false, error: 'Element not found' };
          }

          try {
            ${this.getActionScript(rule)}
            return { success: true };
          } catch (error) {
            return { success: false, error: error.message };
          }
        })()
      `) as { success: boolean; error?: string };

      if (!result.success) {
        return {
          success: false,
          error: {
            type: 'ui',
            message: result.error || 'Interaction failed',
            element: rule.selector,
            action: rule.action,
            timestamp: Date.now(),
          },
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          type: 'ui',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          element: rule.selector,
          action: rule.action,
          timestamp: Date.now(),
        },
      };
    }
  }

  private getActionScript(rule: UIValidationRule): string {
    switch (rule.action) {
      case 'click':
        return 'element.click();';
      case 'type':
        return `element.value = '${rule.value || ''}'; element.dispatchEvent(new Event('input', { bubbles: true }));`;
      case 'check':
        return `if (element.checked !== ${rule.expected === 'checked'}) { throw new Error('Checkbox state mismatch'); }`;
      case 'wait':
        return `setTimeout(() => {}, ${rule.timeout || 1000});`;
      default:
        return '';
    }
  }

  async validateMultiple(rules: UIValidationRule[]): Promise<{ success: boolean; errors: UIError[] }> {
    const errors: UIError[] = [];

    for (const rule of rules) {
      const result = await this.validateInteraction(rule);
      if (!result.success && result.error) {
        errors.push(result.error);
      }
    }

    return {
      success: errors.length === 0,
      errors,
    };
  }
}

