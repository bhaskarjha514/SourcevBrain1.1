import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  gemini: {
    apiKey: string;
  };
  devServer: {
    port: number;
    url: string;
    startCommand: string;
  };
  browser: {
    headless: boolean;
    timeout: number;
  };
  test: {
    timeout: number;
    maxRetryAttempts: number;
  };
}

export function loadConfig(): Config {
  return {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
    },
    devServer: {
      port: parseInt(process.env.DEV_SERVER_PORT || '3000', 10),
      url: process.env.DEV_SERVER_URL || 'http://localhost:3000',
      startCommand: process.env.DEV_SERVER_START_COMMAND || 'npm start',
    },
    browser: {
      headless: process.env.BROWSER_HEADLESS !== 'false',
      timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000', 10),
    },
    test: {
      timeout: parseInt(process.env.TEST_TIMEOUT || '10000', 10),
      maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '5', 10),
    },
  };
}

