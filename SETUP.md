# How to Use the Browser Error Debugging MCP Server

## Step 1: Configure MCP Server in Cursor

You need to add this MCP server to Cursor's configuration. The configuration file location depends on your OS:

- **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
- **Windows**: `%APPDATA%\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`
- **Linux**: `~/.config/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`

Alternatively, in Cursor:
1. Open Command Palette (Cmd/Ctrl + Shift + P)
2. Search for "MCP" or "Model Context Protocol"
3. Look for MCP server settings

Add this configuration:

```json
{
  "mcpServers": {
    "browser-error-debugging": {
      "command": "node",
      "args": [
        "/Users/bhaskarjha/personal/AIProjects/source/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Note**: Update the path to match your actual project location.

## Step 2: Restart Cursor

After adding the configuration, restart Cursor to load the MCP server.

## Step 3: Verify the Server is Running

1. Open Cursor
2. Check the MCP status (usually in the status bar or MCP panel)
3. You should see "browser-error-debugging" listed as an available server

## Step 4: Using the MCP Tools

Once configured, you can use the MCP tools directly in Cursor. Here are examples:

### Example 1: Test a Feature

Ask Cursor:
```
Test the login feature on my React app using the mcp_test_feature tool
```

Or be more specific:
```
Use mcp_test_feature to test the "user login" feature at http://localhost:3000/login
```

### Example 2: Capture Console Errors

Ask Cursor:
```
Capture all console errors from http://localhost:3000 using mcp_capture_console_errors
```

### Example 3: Auto-Fix and Retest (Most Useful!)

Ask Cursor:
```
Use mcp_fix_and_retest to test the "shopping cart" feature and automatically fix any errors until it works
```

### Example 4: Run Multiple Features

Ask Cursor:
```
Use mcp_run_feature_suite to test all these features: login, cart, checkout. Fix any errors automatically.
```

## Workflow Example

Here's a typical workflow:

1. **You write code** for a new feature in Cursor
2. **Ask Cursor to test it**:
   ```
   Test the new "add to cart" feature I just wrote. Use mcp_fix_and_retest to automatically fix any errors.
   ```
3. **The MCP server will**:
   - Detect if your dev server is running (start it if needed)
   - Open a browser and navigate to your app
   - Test the feature
   - Capture any errors
   - Use Gemini to analyze and fix the errors
   - Retest automatically
   - Repeat until the feature works or max iterations reached
4. **You get feedback** on what was fixed and whether the feature works

## Configuration Tips

### For React Projects

Make sure your `.env` file has:
```
DEV_SERVER_URL=http://localhost:3000
DEV_SERVER_PORT=3000
DEV_SERVER_START_COMMAND=npm start
```

### For Different Ports

If your dev server runs on a different port (e.g., 5173 for Vite):
```
DEV_SERVER_URL=http://localhost:5173
DEV_SERVER_PORT=5173
```

### For Non-React Projects

The server works with any web app, just update the `DEV_SERVER_URL` in `.env`.

## Troubleshooting

### Server Not Appearing in Cursor

1. Check the path in the MCP configuration is correct
2. Make sure you've built the project: `npm run build`
3. Restart Cursor
4. Check Cursor's MCP logs/console for errors

### Browser Not Connecting

- The server will automatically fall back to Playwright if CDP fails
- Make sure Playwright browsers are installed: `npx playwright install`

### Dev Server Not Starting

- Check your `DEV_SERVER_START_COMMAND` in `.env`
- Make sure you're in the correct directory when testing
- The server will try to start it from the current working directory

## Advanced Usage

### Custom UI Validation

You can specify UI validation rules:

```json
{
  "name": "login feature",
  "url": "http://localhost:3000/login",
  "uiRules": [
    {
      "selector": "#email-input",
      "action": "type",
      "value": "test@example.com"
    },
    {
      "selector": "#password-input",
      "action": "type",
      "value": "password123"
    },
    {
      "selector": "#login-button",
      "action": "click"
    },
    {
      "selector": ".welcome-message",
      "action": "wait"
    }
  ]
}
```

Ask Cursor to use these rules when testing features.

