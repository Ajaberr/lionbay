# Render Deployment Guide for Columbia University Marketplace

This guide provides step-by-step instructions for deploying the Columbia University Marketplace application to Render.

## Prerequisites

1. A Render account (https://render.com)
2. Your project's Git repository (GitHub, GitLab, or Bitbucket)
3. Basic familiarity with Node.js and web deployment

## Deployment Steps

### 1. Create a PostgreSQL Database

First, create a PostgreSQL database that your application will use:

1. Log in to your Render dashboard
2. Click on "PostgreSQL" in the left sidebar
3. Click "New PostgreSQL" button
4. Fill in the database details:
   - Name: `cump-db` (or your preferred name)
   - PostgreSQL Version: 14 (or the version you're using)
   - Region: Choose a region close to your users
   - Instance Type: Choose based on your needs (at least "Starter" for production)
5. Click "Create Database"
6. Once created, note the "External Connection String" - you'll need this for your web service

### 2. Create a Web Service

1. In your Render dashboard, click on "Web Services" in the left sidebar
2. Click the "New Web Service" button
3. Connect your GitHub/GitLab/Bitbucket repository
4. Configure the service:
   - Name: `lion-bay` (or your preferred name)
   - Region: Choose the same region as your database
   - Branch: `main` (or the branch you want to deploy)
   - Root Directory: Leave empty if your project is at the root
   - Runtime: `Node`
   - Build Command: `./build.sh` (uses the build script we created)
   - Start Command: `npm start`
   - Instance Type: At least "Standard" for production use

### 3. Set Environment Variables

In the "Environment" section of your web service, add the following variables:

```
NODE_ENV=production
JWT_SECRET=[generate a secure random string]
DATABASE_URL=[your Render PostgreSQL External Connection String]
CORS_ORIGIN=[your frontend URL, e.g., https://lion-bay.onrender.com]
EMAIL_USER=[email for sending notifications]
EMAIL_PASSWORD=[app password for the email account]
RESEND_API_KEY=[your Resend API key if you're using Resend]
ADMIN_EMAILS=[comma-separated list of admin emails]
SKIP_EMAIL_VERIFICATION=FALSE
```

To generate a secure random string for JWT_SECRET, you can use this command:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. (Optional) Configure Auto-Deploy

By default, Render will automatically redeploy your application when changes are pushed to your connected branch. You can configure this in the "Settings" tab of your web service.

### 5. Deploy Your Service

Click "Create Web Service" to start the deployment process. Render will:
1. Clone your repository
2. Install dependencies
3. Build your application
4. Start your service

You can monitor the deployment process in the "Logs" tab.

### 6. Verify Deployment

Once deployed, verify that:
1. Your application is accessible at the provided URL
2. You can register and log in
3. Database operations work correctly
4. All features function as expected

## Connecting Frontend to Backend

If your frontend and backend are deployed separately:

1. Make sure your frontend's API calls are pointing to your backend URL
2. Update the `CORS_ORIGIN` environment variable in your backend to allow requests from your frontend URL

## Troubleshooting

### Database Connection Issues

If your application can't connect to the database:
1. Verify the `DATABASE_URL` is correct
2. Make sure your application is properly handling the SSL requirements (Render PostgreSQL requires SSL)
3. Check if your database is in the same region as your web service

### Build Failures

If your build fails:
1. Check the build logs for specific errors
2. Verify your `build.sh` script has the correct permissions (`chmod +x build.sh`)
3. Make sure all dependencies are correctly listed in your package.json

### Runtime Errors

If your application runs but shows errors:
1. Check the application logs in the "Logs" tab
2. Verify all environment variables are correctly set
3. Make sure your frontend is correctly pointing to your backend URL

## Maintenance

### Scaling

As your application grows, you may need to scale your resources:
1. Navigate to your web service or database in the Render dashboard
2. Go to the "Settings" tab
3. Change the "Instance Type" to a higher tier

### Monitoring

Render provides basic monitoring for your services:
1. Navigate to your web service in the Render dashboard
2. Check the "Metrics" tab for CPU, memory, and network usage
3. Set up additional monitoring using a third-party service if needed 