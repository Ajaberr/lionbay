# Lion Bay Database Diagnostic Tools

This directory contains tools to help diagnose and fix database connection issues, especially when deploying to Render.

## Files Included

1. `db-test.js` - Basic script to test local database connections
2. `render-db-test.js` - Enhanced script simulating the Render environment
3. `render-diagnostic.js` - Full diagnostic web app that can be deployed to Render
4. `diagnostic-package.json` - Package.json for deploying the diagnostic web app

## Using the Tools Locally

### Basic Database Test

Run this to test the local database connection:

```bash
node db-test.js
```

### Render Simulation Test

Run this to test your database connection as if running on Render:

```bash
node render-db-test.js
```

## Deploying the Diagnostic Web App to Render

To diagnose issues directly on Render, you can deploy the diagnostic web app:

1. Create a new Web Service on Render
2. Use your GitHub repository or upload the diagnostic files directly
3. Set the build command to: `npm install`
4. Set the start command to: `node render-diagnostic.js`
5. Add the following environment variables:
   - `DATABASE_URL` - Same as your main application
   - `NODE_ENV` - Set to `production`

After deployment, you can access the diagnostic tool at the URL provided by Render.

## Common Database Issues and Solutions

### 1. Connection String Problems

Make sure your connection string is in the correct format:
```postgresql://username:password@host:port/database
```

### 2. SSL Requirements

Render PostgreSQL requires SSL. The tools in this package already set:
```javascript
ssl: {
  rejectUnauthorized: false
}
```

### 3. Environment Variables

Double check that the correct environment variables are set:
- On local: `DATABASE_URL` in your `.env` file
- On Render: `DATABASE_URL` in the environment variables section of your service

### 4. Network Access

Ensure the database allows connections from your Render service. For Render-managed databases, this is automatic. For external databases, check firewall rules.

### 5. Connection Limits

Check if you've hit connection limits. The Render diagnostic tool will show current connection counts.

## Render-Specific Environment Variables

Render sets additional environment variables that might be helpful:

- `RENDER` - Set to `true` in Render environments
- `RENDER_SERVICE_ID` - Your service ID
- `RENDER_EXTERNAL_URL` - The public URL of your service

## Getting Additional Help

If these tools don't resolve your issue:

1. Check the Render logs for your service
2. Look at the output of the `/api/full-report` endpoint from the diagnostic web app
3. Contact Render support with the full diagnostic report 