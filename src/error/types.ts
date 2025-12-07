export interface BrowserError {
  type: 'console' | 'network' | 'react' | 'ui';
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
  url?: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface ConsoleError extends BrowserError {
  type: 'console';
  level: 'error' | 'warning' | 'info';
  args?: unknown[];
}

export interface NetworkError extends BrowserError {
  type: 'network';
  status?: number;
  statusText?: string;
  method?: string;
  requestUrl?: string;
}

export interface ReactError extends BrowserError {
  type: 'react';
  componentStack?: string;
  errorBoundary?: string;
}

export interface UIError extends BrowserError {
  type: 'ui';
  element?: string;
  action?: string;
  expected?: string;
  actual?: string;
}

export type ErrorCollection = {
  errors: BrowserError[];
  hasErrors: boolean;
  summary: string;
};

