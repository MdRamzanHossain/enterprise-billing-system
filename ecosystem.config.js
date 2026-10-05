module.exports = {
  apps: [
    {
      name: 'sec-gadgets-billing',
      script: 'server.js',
      instances: 1, // Single instance preserves in-memory token sessions cleanly
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true
    }
  ]
};
