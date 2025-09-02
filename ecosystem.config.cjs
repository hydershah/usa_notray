module.exports = {
  apps: [{
    name: 'usa-notray',
    script: './dist/index.cjs',
    cwd: process.cwd(),
    instances: 1,
    exec_mode: 'fork',
    
    // Environment configuration
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3000
    },
    
    // Logging configuration
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Process management
    max_memory_restart: '2G',
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Node.js options
    node_args: '--max-old-space-size=2048 --optimize-for-size',
    
    // Auto restart settings
    autorestart: true,
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'dist', 'client/dist'],
    
    // Health check
    health_check_http: {
      path: '/health',
      port: 3000,
      timeout: 10000,
      interval: 30000
    },
    
    // Kill timeout for graceful shutdown
    kill_timeout: 5000,
    
    // Wait for ready signal
    wait_ready: true,
    listen_timeout: 10000,
    
    // Source map support
    source_map_support: true,
    
    // PM2 specific options
    pmx: true,
    merge_logs: true,
    
    // Pre-deploy hooks
    pre_deploy: 'npm run build',
    
    // Post-deploy hooks
    // Ensure server installs deps, builds, then starts with the correct ecosystem file
    post_deploy: 'npm ci && npm run build && npm run db:migrate && pm2 startOrReload ecosystem.config.cjs --env production',
    
    // Environment-specific overrides
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      SERVE_STATIC_FILES: 'true'
    }
  }],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'your-git-repo-url',
      path: '/opt/usa_notray',
      'pre-deploy-local': 'npm run build',
      'post-deploy': 'npm ci && npm run build && npm run db:migrate && pm2 startOrReload ecosystem.config.cjs --env production',
      'pre-setup': 'mkdir -p /opt/usa_notray/logs'
    },
    staging: {
      user: 'deploy',
      host: 'your-staging-server-ip',
      ref: 'origin/develop',
      repo: 'your-git-repo-url',
      path: '/opt/usa_notray-staging',
      'pre-deploy-local': 'npm run build',
      'post-deploy': 'npm ci && npm run build && npm run db:migrate && pm2 startOrReload ecosystem.config.cjs --env staging',
      'pre-setup': 'mkdir -p /opt/usa_notray/logs'
    }
  }
};
