import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadConfig } from '../utils/config.js';
import type { BrowserError, ErrorCollection } from '../error/types.js';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface CodeFix {
  file: string;
  changes: {
    line: number;
    oldCode: string;
    newCode: string;
  }[];
  explanation: string;
}

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private config = loadConfig();

  constructor() {
    if (!this.config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    this.genAI = new GoogleGenerativeAI(this.config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  async analyzeErrors(errors: ErrorCollection): Promise<string> {
    const errorSummary = this.formatErrorsForAnalysis(errors);

    const prompt = `You are a debugging assistant. Analyze the following browser errors and provide a detailed analysis:

${errorSummary}

Provide:
1. Root cause analysis
2. Most likely file(s) and line(s) where the issue occurs
3. Suggested fix approach

Be concise and specific.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateFix(
    errors: ErrorCollection,
    fileContent?: string,
    filePath?: string
  ): Promise<CodeFix | null> {
    const errorSummary = this.formatErrorsForAnalysis(errors);
    const fileContext = fileContent ? `\n\nCurrent file content:\n\`\`\`\n${fileContent}\n\`\`\`` : '';

    const prompt = `You are a code fixing assistant. Fix the following errors in the code:

${errorSummary}${fileContext}

Provide a JSON response with this exact structure:
{
  "file": "path/to/file.tsx",
  "changes": [
    {
      "line": 42,
      "oldCode": "const x = null;",
      "newCode": "const x = {};"
    }
  ],
  "explanation": "Brief explanation of the fix"
}

Only include the JSON, no other text. If you cannot determine the fix, return null.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      if (text.toLowerCase() === 'null' || text === '') {
        return null;
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const fix = JSON.parse(jsonMatch[0]) as CodeFix;
      if (filePath) {
        fix.file = filePath;
      }

      return fix;
    } catch (error) {
      console.error('Error generating fix:', error);
      return null;
    }
  }

  async applyFix(fix: CodeFix): Promise<boolean> {
    try {
      const filePath = path.resolve(process.cwd(), fix.file);

      if (!existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return false;
      }

      let content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (const change of fix.changes.sort((a, b) => b.line - a.line)) {
        const lineIndex = change.line - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          if (lines[lineIndex].trim() === change.oldCode.trim()) {
            lines[lineIndex] = change.newCode;
          } else {
            console.warn(`Line ${change.line} does not match expected content. Skipping.`);
          }
        }
      }

      content = lines.join('\n');
      await writeFile(filePath, content, 'utf-8');

      return true;
    } catch (error) {
      console.error('Error applying fix:', error);
      return false;
    }
  }

  private formatErrorsForAnalysis(errors: ErrorCollection): string {
    if (errors.errors.length === 0) {
      return 'No errors detected.';
    }

    return errors.errors.map((error, index) => {
      let formatted = `Error ${index + 1} (${error.type}):\n`;
      formatted += `  Message: ${error.message}\n`;
      if (error.stack) {
        formatted += `  Stack: ${error.stack}\n`;
      }
      if (error.source) {
        formatted += `  Source: ${error.source}`;
        if (error.line) {
          formatted += `:${error.line}`;
          if (error.column) {
            formatted += `:${error.column}`;
          }
        }
        formatted += '\n';
      }
      if (error.context) {
        formatted += `  Context: ${JSON.stringify(error.context, null, 2)}\n`;
      }
      return formatted;
    }).join('\n');
  }
}

