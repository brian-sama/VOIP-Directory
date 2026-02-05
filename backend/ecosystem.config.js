module.exports = {
    apps: [{
        name: 'voip-directory-backend',
        script: './server.js',
        instances: 'max', // Use all CPU cores
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 5001
        },
        env_development: {
            NODE_ENV: 'development',
            PORT: 5001
        },
        error_file: './logs/err.log',
        out_file: './logs/out.log',
        log_file: './logs/combined.log',
        time: true,
        max_memory_restart: '500M',
        // Graceful shutdown
        kill_timeout: 5000,
        listen_timeout: 10000,
        // Auto-restart on crash
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s'
    }]
};
