import type { BrowserError, ErrorCollection } from '../error/types.js';
import { GeminiClient, type CodeFix } from '../gemini/client.js';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface FixResult {
  success: boolean;
  fix?: CodeFix;
  error?: string;
}

export class CursorIntegration {
  private geminiClient: GeminiClient;

  constructor() {
    this.geminiClient = new GeminiClient();
  }

  async reportError(error: ErrorCollection): Promise<string> {
    const analysis = await this.geminiClient.analyzeErrors(error);
    return analysis;
  }

  async fixError(error: ErrorCollection): Promise<FixResult> {
    try {
      const errorWithSource = error.errors.find((e) => e.source);
      let filePath: string | undefined;
      let fileContent: string | undefined;

      if (errorWithSource?.source) {
        filePath = this.extractFilePath(errorWithSource.source);
        if (filePath && existsSync(filePath)) {
          fileContent = await readFile(filePath, 'utf-8');
        }
      }

      const fix = await this.geminiClient.generateFix(error, fileContent, filePath);

      if (!fix) {
        return {
          success: false,
          error: 'Could not generate fix for the error',
        };
      }

      const applied = await this.geminiClient.applyFix(fix);

      if (!applied) {
        return {
          success: false,
          error: 'Failed to apply fix to file',
          fix,
        };
      }

      return {
        success: true,
        fix,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during fix',
      };
    }
  }

  private extractFilePath(source: string): string | undefined {
    if (!source || source.startsWith('http://') || source.startsWith('https://')) {
      return undefined;
    }

    const match = source.match(/^(.+?)(?::\d+)?$/);
    if (match) {
      let filePath = match[1];
      if (filePath.startsWith('/')) {
        return filePath;
      }
      return path.resolve(process.cwd(), filePath);
    }

    return undefined;
  }

  async formatErrorForCursor(error: ErrorCollection): Promise<string> {
    const summary = `## Error Summary\n\n${error.summary}\n\n`;
    const details = error.errors.map((e, i) => {
      let detail = `### Error ${i + 1}: ${e.type}\n\n`;
      detail += `**Message:** ${e.message}\n\n`;
      if (e.stack) {
        detail += `**Stack Trace:**\n\`\`\`\n${e.stack}\n\`\`\`\n\n`;
      }
      if (e.source) {
        detail += `**Source:** ${e.source}`;
        if (e.line) {
          detail += `:${e.line}`;
          if (e.column) {
            detail += `:${e.column}`;
          }
        }
        detail += '\n\n';
      }
      return detail;
    }).join('\n');

    return summary + details;
  }
}

