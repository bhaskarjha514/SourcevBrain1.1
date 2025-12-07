# Browser Error Debugging MCP Server

An MCP server that automates browser testing, error detection, and iterative debugging for React applications. It integrates with Cursor to automatically fix errors until features work completely.

## Features

- **Browser Automation**: Uses Chrome DevTools Protocol (CDP) with Playwright fallback
- **Error Detection**: Captures console errors, network failures, React errors, and UI issues
- **Automatic Fixes**: Uses Gemini AI to analyze errors and generate code fixes
- **Iterative Testing**: Automatically retests after fixes until features work
- **Dev Server Management**: Automatically detects and starts development servers

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Add your Gemini API key to `.env`:
```
GEMINI_API_KEY=your_api_key_here
```

4. Build the project:
```bash
npm run build
```

## Configuration

Edit `.env` to configure:

- `GEMINI_API_KEY`: Your Google Gemini API key (required)
- `DEV_SERVER_PORT`: Port your dev server runs on (default: 3000)
- `DEV_SERVER_URL`: Full URL to your dev server (default: http://localhost:3000)
- `DEV_SERVER_START_COMMAND`: Command to start dev server (default: npm start)
- `BROWSER_HEADLESS`: Run browser in headless mode (default: true)
- `BROWSER_TIMEOUT`: Browser operation timeout in ms (default: 30000)
- `TEST_TIMEOUT`: Test timeout in ms (default: 10000)
- `MAX_RETRY_ATTEMPTS`: Maximum fix iterations (default: 5)

## MCP Tools

### `mcp_test_feature`

Test a specific feature in the browser and return any errors found.

**Parameters:**
- `name` (required): Name of the feature to test
- `url` (optional): URL to navigate to
- `uiRules` (optional): Array of UI validation rules
- `waitTime` (optional): Time to wait after navigation in ms

### `mcp_capture_console_errors`

Capture current console errors from the browser.

**Parameters:**
- `url` (optional): URL to navigate to before capturing

### `mcp_fix_and_retest`

Automatically fix errors and retest until feature works.

**Parameters:**
- `feature` (required): Feature test configuration
- `maxIterations` (optional): Maximum number of fix iterations

### `mcp_run_feature_suite`

Run multiple features sequentially with auto-fix loop.

**Parameters:**
- `features` (required): Array of feature test configurations
- `maxIterations` (optional): Maximum fix iterations per feature

## Usage

### Running the MCP Server

```bash
npm start
```

Or in development mode:
```bash
npm run dev
```

### Example: Testing a Feature

The MCP server can be called from Cursor or any MCP client. Example workflow:

1. Use `mcp_test_feature` to test a feature
2. If errors are found, use `mcp_fix_and_retest` to automatically fix and retest
3. The server will iterate until the feature works or max iterations is reached

## Architecture

- **Browser Controller**: Manages browser instances with CDP/Playwright
- **Error Detector**: Monitors and captures various error types
- **Test Runner**: Executes feature tests and validates UI
- **Dev Server Manager**: Handles dev server lifecycle
- **Gemini Client**: Analyzes errors and generates fixes
- **Cursor Integration**: Reports errors and applies fixes

## Browser Support

- **Primary**: Chrome DevTools Protocol (CDP) via `chrome-remote-interface`
- **Fallback**: Playwright for broader compatibility

The server automatically falls back to Playwright if CDP connection fails.

## Error Types Detected

- **Console Errors**: JavaScript errors, warnings, uncaught exceptions
- **Network Errors**: Failed requests, 4xx/5xx responses
- **React Errors**: Component errors, error boundaries
- **UI Errors**: Missing elements, failed interactions

## License

MIT
