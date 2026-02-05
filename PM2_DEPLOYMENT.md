# Deploying with PM2 for 1000+ Users

## Prerequisites

- Node.js v18+ installed
- MySQL server configured with `max_connections = 2000`

## Installation

```bash
npm install -g pm2
```

## Running in Development

```bash
cd backend
npm install
pm2 start ecosystem.config.js --env development
```

## Running in Production

```bash
cd backend
pm2 start ecosystem.config.js --env production
```

## PM2 Management Commands

```bash
# View all processes
pm2 list

# View logs
pm2 logs voip-directory-backend

# Monitor CPU/RAM usage
pm2 monit

# Restart all processes
pm2 restart all

# Stop all processes
pm2 stop all

# Delete all processes
pm2 delete all

# Save process list (auto-restart on system reboot)
pm2 save
pm2 startup
```

## Cluster Mode Benefits

The `ecosystem.config.js` is configured to run in **cluster mode** with `instances: 'max'`, which:

- Spawns one instance per CPU core
- Load-balances requests across all cores
- Auto-restarts crashed instances
- Allows 0-downtime deployments

## Load Testing

To test with 1000 concurrent users:

```bash
npm install -g artillery

# Create test file: load-test.yml
artillery quick --count 1000 --num 5 http://localhost:5001/api/users
```

## System Requirements for 1000 Users

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 4GB | 8GB |
| CPU Cores | 4 | 8 |
| MySQL | Separate server | Managed DB (RDS, PlanetScale) |

## Environment Variables

Create `.env` in backend folder:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=bcc_voip_directory
JWT_SECRET=change_this_in_production
FRONTEND_URL=http://localhost:5173
PORT=5001
NODE_ENV=production
```
