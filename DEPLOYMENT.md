# MarketCU Deployment Guide

This guide provides step-by-step instructions for deploying the MarketCU application to Render.com or similar hosting platforms.

## Prerequisites

- Node.js 16 or higher
- Git
- A Render.com account (or another hosting platform of your choice)
- PostgreSQL database (can be hosted on Render or elsewhere)

## Local Preparation

Before deploying, test the production build locally:

1. Ensure you have all files committed to your repository
2. Make the build script executable:
   ```bash
   chmod +x build-production.sh
   ```
3. Run the production build script:
   ```bash
   ./build-production.sh
   ```
4. Test the production build locally:
   ```bash
   NODE_ENV=production npm start
   ```
5. Verify that the application works correctly in your browser at http://localhost:3001

## Deployment to Render

### Option 1: Using render.yaml (Recommended)

1. Commit and push your changes to your Git repository
2. Go to your Render dashboard: https://dashboard.render.com/
3. Click "New" and select "Blueprint"
4. Connect your repository
5. Render will automatically detect the `render.yaml` file and configure your service

### Option 2: Manual Setup

1. Go to your Render dashboard: https://dashboard.render.com/
2. Click "New" and select "Web Service"
3. Connect your repository
4. Configure the following settings:
   - **Name**: marketcu (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `./build-production.sh`
   - **Start Command**: `./render-start.sh`
   - **Plan**: Free (or choose a paid plan for better performance)

5. Add the following environment variables:
   - `NODE_ENV`: production
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure random string for JWT token generation
   - Any other environment variables needed (email configuration, etc.)

6. Click "Create Web Service" and wait for the deployment to complete

## Database Setup

### Option 1: Using Render PostgreSQL

1. In your Render dashboard, go to "New" and select "PostgreSQL"
2. Configure your database settings and create the database
3. Once created, find the "External Connection String" (this will be your `DATABASE_URL`)
4. Add this connection string as an environment variable in your web service

### Option 2: Using Another PostgreSQL Provider

1. Set up a PostgreSQL database with your preferred provider
2. Obtain the connection string in the format: `postgres://username:password@host:port/database`
3. Add this connection string as the `DATABASE_URL` environment variable in your Render web service

## Troubleshooting

If you encounter issues with your deployment, check the following:

1. **Build Failures**:
   - Check the build logs in your Render dashboard
   - Ensure all necessary dependencies are included in package.json
   - Verify that build scripts have execute permissions

2. **Connection Issues**:
   - Test the API endpoints using the `/api/health` and `/api/test` routes
   - Check that CORS is configured correctly for your frontend domain
   - Verify database connection using the `/api/test` endpoint

3. **Frontend Not Loading**:
   - Check if the build directory is being correctly located by the server
   - Look for error messages in the browser console
   - Verify that the static files are being served correctly

4. **Database Problems**:
   - Ensure your database connection string is correct
   - Check if the database tables exist and have the correct schema
   - Look for database connection errors in the server logs

## Monitoring and Maintenance

Once deployed, monitor your application using:

1. Render's built-in logs and metrics
2. Custom logging to an external service
3. Regular checks of the `/api/health` endpoint

## Updating Your Deployment

To update your application:

1. Make changes to your codebase
2. Commit and push to your repository
3. Render will automatically detect changes and redeploy your application

## Security Considerations

Ensure your production deployment follows security best practices:

1. Use environment variables for all sensitive information
2. Set up proper CORS restrictions for production
3. Ensure SSL/TLS is enabled for all connections
4. Regularly update dependencies to address security vulnerabilities

## Resources

- [Render.com Documentation](https://render.com/docs)
- [Node.js Deployment Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/) 