/**
 * API Test Endpoint
 * 
 * This file adds a simple test endpoint to the server that can be used to diagnose
 * connection issues and verify the server is running properly in production.
 */

function addApiTestEndpoints(app, pool) {
  // Simple health check endpoint - no database connection required
  app.get('/api/health', (req, res) => {
    const serverInfo = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      serverTime: new Date().toString(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      endpoints: [
        { method: 'GET', path: '/api/health', description: 'Basic server health check' },
        { method: 'GET', path: '/api/test', description: 'Tests database connection and server functionality' },
        { method: 'GET', path: '/api/test/cors', description: 'Tests CORS configuration' },
        { method: 'GET', path: '/api/test/headers', description: 'Returns request headers for debugging' }
      ]
    };
    
    res.json(serverInfo);
  });
  
  // Test endpoint that checks database connection
  app.get('/api/test', async (req, res) => {
    const start = Date.now();
    
    try {
      // Test database connection
      const dbResult = await pool.query('SELECT NOW() as server_time');
      
      // Return test results
      res.json({
        success: true,
        message: 'Server is running and database connection is working',
        databaseConnected: true,
        databaseTime: dbResult.rows[0].server_time,
        responseTime: Date.now() - start + 'ms',
        environment: process.env.NODE_ENV || 'development',
        serverInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          memoryUsage: process.memoryUsage(),
        },
        request: {
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          origin: req.get('Origin') || 'Not specified'
        }
      });
    } catch (error) {
      console.error('API test database error:', error);
      
      res.status(500).json({
        success: false,
        message: 'Server is running but database connection failed',
        databaseConnected: false,
        error: {
          message: error.message,
          code: error.code
        },
        responseTime: Date.now() - start + 'ms',
        environment: process.env.NODE_ENV || 'development',
        serverInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          memoryUsage: process.memoryUsage(),
        },
        request: {
          url: req.url,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          origin: req.get('Origin') || 'Not specified'
        }
      });
    }
  });
  
  // CORS test endpoint
  app.get('/api/test/cors', (req, res) => {
    res.json({
      success: true,
      message: 'CORS is properly configured',
      origin: req.get('Origin') || 'No Origin header',
      headers: {
        'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers')
      }
    });
  });
  
  // Headers debug endpoint
  app.get('/api/test/headers', (req, res) => {
    res.json({
      requestHeaders: req.headers,
      responseHeaders: res._headers,
      serverInfo: {
        nodeEnv: process.env.NODE_ENV,
        platform: process.platform,
        arch: process.arch
      }
    });
  });
  
  console.log('API test endpoints added');
}

module.exports = { addApiTestEndpoints }; 