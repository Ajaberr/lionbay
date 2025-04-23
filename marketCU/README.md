# Columbia University Marketplace

A platform for Columbia University students to buy and sell items within the university community.

## Setup Instructions

### Prerequisites
- Node.js v14 or higher
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/columbia-marketplace.git
cd columbia-marketplace
```

2. Install dependencies for frontend
```bash
npm install
```

3. Install dependencies for backend
```bash
cd server
npm install
cd ..
```

### Environment Variables

This project uses environment variables to manage sensitive information and configuration. You need to create `.env` files for both frontend and backend.

#### Frontend Environment (.env)

Create a `.env` file in the root directory:

```
VITE_API_BASE_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

#### Backend Environment (server/.env)

Create a `.env` file in the server directory:

```
# Database Configuration
DATABASE_URL=your-postgresql-connection-string
# For development, you can use the provided Render PostgreSQL URL:
# DATABASE_URL=postgresql://cump_db_user:2x5LNUrbJwC1rrA4MPmVMkrk8fjZU9QW@dpg-cvdo1ulumphs73bjbp8g-a.oregon-postgres.render.com/cump_db

# Security
JWT_SECRET=your-jwt-secret-key

# Email Service
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-email-app-password
RESEND_API_KEY=your-resend-api-key

# Admin Configuration
ADMIN_EMAILS=email1@domain.com,email2@domain.com

# Email Verification (set to FALSE in production)
SKIP_EMAIL_VERIFICATION=TRUE

# Server Configuration
PORT=3001
```

### Database Setup

This project uses PostgreSQL hosted on Render. The database is pre-configured with the following:

1. Sample product data
2. User tables
3. Messaging tables
4. Transaction history

When deploying to Render:
1. Add the `DATABASE_URL` environment variable in your Render web service settings
2. No additional database setup is required as the schema will be automatically managed by the application

### Running the Application

1. Start the backend server
```bash
cd server
npm run dev
```

2. Start the frontend development server
```bash
# In another terminal, from the project root
npm run dev
```

3. Access the application
Open your browser and navigate to `http://localhost:5173`

## Security Note

- Never commit your `.env` files to version control
- The `.env.example` files are provided as templates
- Always use environment variables for sensitive information
- Protect your database credentials, especially the PostgreSQL connection string
- Only Columbia University email addresses (@columbia.edu) are allowed for registration and login

## Email Verification

The system currently includes an auto-fill feature for verification codes in development mode. This should be removed in production:

1. In `server/server.js`, remove the `code: verificationCode` lines from the API responses:
   - Around line 100: `message: 'Verification code ready (email sending skipped)', code: verificationCode`
   - Around line 130: `message: 'Verification code sent to email', code: verificationCode`

2. In `src/App.jsx`, remove the auto-fill code from the `handleSendCode` function:
   ```javascript
   // Remove this block
   if (response.data.code) {
     setVerificationCode(response.data.code);
   }
   ```

## Admin Accounts

### Current Admin Configuration

Admin accounts are configured in two places:

1. In the server-side code (`server/server.js`):
   ```javascript
   const adminEmails = ['aaa2485@columbia.edu', 'amj2234@columbia.edu'];
   ```

2. For better configurability, you can now edit the `ADMIN_EMAILS` environment variable in the `.env` file:
   ```
   ADMIN_EMAILS=aaa2485@columbia.edu,amj2234@columbia.edu
   ```

### Adding New Admins

To add new admin accounts:

1. Edit the `ADMIN_EMAILS` variable in your `.env` file, adding new email addresses separated by commas:
   ```
   ADMIN_EMAILS=aaa2485@columbia.edu,amj2234@columbia.edu,newemail@columbia.edu
   ```

2. Restart the server for changes to take effect.

### Admin Features

Admin accounts have access to:
- Admin dashboard at `/admin`
- User management 
- Product moderation
- System settings

## Tech Stack

- Frontend: React, CSS
- Backend: Node.js, Express
- Database: PostgreSQL

## Deploying to Render

### Prerequisites
- A Render account (https://render.com)
- Git repository for your project

### Deployment Steps

1. Log in to your Render account

2. Create a new Web Service
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repository

3. Configure your Web Service
   - Name: Choose a name for your application
   - Region: Choose the closest region to your users
   - Branch: main (or your default branch)
   - Root Directory: Leave empty if your project is at the root of the repository
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Instance Type: Recommend at least "Standard" for production use

4. Add Environment Variables
   - Add all required environment variables from the `.env.example` file:
     - `NODE_ENV`: Set to `production`
     - `PORT`: Render will automatically set this, but you can leave it as 3001
     - `JWT_SECRET`: A secure random string for JWT token generation
     - `DATABASE_URL`: Your Render PostgreSQL connection string
     - `CORS_ORIGIN`: The URL where your frontend is hosted
     - Add any other required environment variables for email, admin configuration, etc.

5. Create a PostgreSQL Database
   - In Render dashboard, go to "PostgreSQL"
   - Click "New +"
   - Configure your database name, user, and region
   - Once created, copy the "External Connection String"
   - Add this connection string as the `DATABASE_URL` environment variable in your Web Service

6. Deploy Your Service
   - Click "Create Web Service"
   - Render will automatically build and deploy your application
   - You can monitor the deployment progress in the logs

### Post-Deployment

1. Verify your deployment is working by visiting the URL provided by Render
2. Check the logs for any errors
3. Test critical functionality (user login, database operations, etc.)
4. Update the CORS settings in your server if needed to allow requests from your frontend domain

### Continuous Deployment

By default, Render will automatically redeploy your application when you push changes to your connected branch. You can configure auto-deploy settings in your Web Service settings.
