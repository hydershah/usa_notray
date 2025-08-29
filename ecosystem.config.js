module.exports = {
  apps: [{
    name: 'usa-notary',
    script: 'dist/index.cjs',
    cwd: '/opt/usa_notray/current',
    instances: 1, // Start with 1 instance, can scale later
    exec_mode: 'fork', // Use fork mode for better stability initially
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    // Logging
    error_file: '/opt/usa_notray/logs/err.log',
    out_file: '/opt/usa_notray/logs/out.log',
    log_file: '/opt/usa_notray/logs/combined.log',
    time: true,
    
    // Process management
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 5,
    
    // Node.js options
    node_args: '--max-old-space-size=1024',
    
    // Auto restart settings
    autorestart: true,
    watch: false,
    
    // Health check
    health_check_http: {
      path: '/health',
      port: 3002,
      timeout: 5000,
      interval: 30000
    }
  }]
};
