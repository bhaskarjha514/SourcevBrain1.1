import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { BrowserControllerImpl } from './browser/controller.js';
import { DevServerManager } from './server/manager.js';
import { TestRunner, type FeatureTest } from './test/runner.js';
import { CursorIntegration } from './cursor/integration.js';
import { loadConfig } from './utils/config.js';
import type { ErrorCollection } from './error/types.js';

class BrowserErrorDebuggingServer {
  private server: Server;
  private browser: BrowserControllerImpl | null = null;
  private devServer: DevServerManager;
  private cursorIntegration: CursorIntegration;
  private config = loadConfig();

  constructor() {
    this.server = new Server(
      {
        name: 'browser-error-debugging',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.devServer = new DevServerManager();
    this.cursorIntegration = new CursorIntegration();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'mcp_test_feature',
          description: 'Test a specific feature in the browser and return any errors found',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the feature to test',
              },
              url: {
                type: 'string',
                description: 'URL to navigate to (optional, uses dev server URL if not provided)',
              },
              uiRules: {
                type: 'array',
                description: 'UI validation rules (optional)',
                items: {
                  type: 'object',
                  properties: {
                    selector: { type: 'string' },
                    action: { type: 'string', enum: ['click', 'type', 'wait', 'check'] },
                    value: { type: 'string' },
                    expected: { type: 'string' },
                    timeout: { type: 'number' },
                  },
                },
              },
              waitTime: {
                type: 'number',
                description: 'Time to wait after navigation (ms)',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'mcp_capture_console_errors',
          description: 'Capture current console errors from the browser',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to navigate to before capturing (optional)',
              },
            },
          },
        },
        {
          name: 'mcp_fix_and_retest',
          description: 'Automatically fix errors and retest until feature works',
          inputSchema: {
            type: 'object',
            properties: {
              feature: {
                type: 'object',
                description: 'Feature test configuration',
                properties: {
                  name: { type: 'string' },
                  url: { type: 'string' },
                  uiRules: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        selector: { type: 'string' },
                        action: { type: 'string' },
                        value: { type: 'string' },
                        expected: { type: 'string' },
                        timeout: { type: 'number' },
                      },
                    },
                  },
                  waitTime: { type: 'number' },
                },
                required: ['name'],
              },
              maxIterations: {
                type: 'number',
                description: 'Maximum number of fix iterations (default: 5)',
              },
            },
            required: ['feature'],
          },
        },
        {
          name: 'mcp_run_feature_suite',
          description: 'Run multiple features sequentially with auto-fix loop',
          inputSchema: {
            type: 'object',
            properties: {
              features: {
                type: 'array',
                description: 'Array of feature test configurations',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    url: { type: 'string' },
                    uiRules: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          selector: { type: 'string' },
                          action: { type: 'string' },
                          value: { type: 'string' },
                          expected: { type: 'string' },
                          timeout: { type: 'number' },
                        },
                      },
                    },
                    waitTime: { type: 'number' },
                  },
                  required: ['name'],
                },
              },
              maxIterations: {
                type: 'number',
                description: 'Maximum fix iterations per feature',
              },
            },
            required: ['features'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'mcp_test_feature':
            return await this.handleTestFeature(args as any);
          case 'mcp_capture_console_errors':
            return await this.handleCaptureErrors(args as any);
          case 'mcp_fix_and_retest':
            return await this.handleFixAndRetest(args as any);
          case 'mcp_run_feature_suite':
            return await this.handleRunFeatureSuite(args as any);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
  }

  private async ensureBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = new BrowserControllerImpl();
      await this.browser.initialize();
    }
  }

  private async handleTestFeature(args: {
    name: string;
    url?: string;
    uiRules?: any[];
    waitTime?: number;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    await this.ensureBrowser();
    await this.devServer.ensureServerRunning();

    const testRunner = new TestRunner(this.browser!);
    const feature: FeatureTest = {
      name: args.name,
      url: args.url || this.config.devServer.url,
      uiRules: args.uiRules,
      waitTime: args.waitTime,
    };

    const result = await testRunner.testFeature(feature);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            feature: result.feature,
            errors: result.errors,
            duration: result.duration,
          }, null, 2),
        },
      ],
    };
  }

  private async handleCaptureErrors(args: { url?: string }): Promise<{
    content: Array<{ type: string; text: string }>;
  }> {
    await this.ensureBrowser();
    await this.devServer.ensureServerRunning();

    if (args.url) {
      await this.browser!.navigate(args.url);
    }

    const testRunner = new TestRunner(this.browser!);
    const errors = await testRunner.testFeature({
      name: 'error-capture',
      url: args.url || this.config.devServer.url,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errors.errors, null, 2),
        },
      ],
    };
  }

  private async handleFixAndRetest(args: {
    feature: FeatureTest;
    maxIterations?: number;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    await this.ensureBrowser();
    await this.devServer.ensureServerRunning();

    const testRunner = new TestRunner(this.browser!);
    const maxIterations = args.maxIterations || this.config.test.maxRetryAttempts;
    const feature = args.feature;

    let iteration = 0;
    let lastResult: any = null;

    while (iteration < maxIterations) {
      iteration++;

      const result = await testRunner.testFeature({
        ...feature,
        url: feature.url || this.config.devServer.url,
      });

      lastResult = result;

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                feature: result.feature,
                iterations: iteration,
                message: 'Feature test passed after fixes',
              }, null, 2),
            },
          ],
        };
      }

      const fixResult = await this.cursorIntegration.fixError(result.errors);

      if (!fixResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                feature: result.feature,
                iterations: iteration,
                error: fixResult.error,
                lastErrors: result.errors,
                message: 'Failed to fix errors',
              }, null, 2),
            },
          ],
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            feature: lastResult?.feature,
            iterations: maxIterations,
            errors: lastResult?.errors,
            message: `Reached maximum iterations (${maxIterations}) without success`,
          }, null, 2),
        },
      ],
    };
  }

  private async handleRunFeatureSuite(args: {
    features: FeatureTest[];
    maxIterations?: number;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    await this.ensureBrowser();
    await this.devServer.ensureServerRunning();

    const results: any[] = [];

    for (const feature of args.features) {
      const testRunner = new TestRunner(this.browser!);
      const maxIterations = args.maxIterations || this.config.test.maxRetryAttempts;

      let iteration = 0;
      let success = false;

      while (iteration < maxIterations) {
        iteration++;

        const result = await testRunner.testFeature({
          ...feature,
          url: feature.url || this.config.devServer.url,
        });

        if (result.success) {
          success = true;
          results.push({
            feature: feature.name,
            success: true,
            iterations: iteration,
          });
          break;
        }

        const fixResult = await this.cursorIntegration.fixError(result.errors);

        if (!fixResult.success) {
          results.push({
            feature: feature.name,
            success: false,
            iterations: iteration,
            error: fixResult.error,
            lastErrors: result.errors,
          });
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!success && iteration >= maxIterations) {
        results.push({
          feature: feature.name,
          success: false,
          iterations: maxIterations,
          message: 'Reached maximum iterations',
        });
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalFeatures: args.features.length,
            results,
            allPassed: results.every((r) => r.success),
          }, null, 2),
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Browser Error Debugging MCP Server running on stdio');
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    await this.devServer.stopServer();
  }
}

const server = new BrowserErrorDebuggingServer();

server.run().catch(console.error);

process.on('SIGINT', async () => {
  await server.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.cleanup();
  process.exit(0);
});

