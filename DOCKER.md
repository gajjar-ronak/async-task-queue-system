# Docker Deployment Guide

This guide explains how to deploy and scale the distributed async task worker system using Docker.

## 🏗️ Architecture

The system consists of the following containerized services:

- **PostgreSQL**: Primary database for persistent data
- **Redis**: Message queue and caching
- **App Service**: REST API, dashboard, and coordination
- **Worker Service(s)**: Task processing nodes (horizontally scalable)

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available for containers
- Ports 3002, 3003, 5432, 6379 available

## 🚀 Quick Start

### 1. Build Images

```bash
./scripts/docker-build.sh
```

This will:
- Build the shared package
- Create Docker images for app and worker services
- Tag images as `async-task-app:latest` and `async-task-worker:latest`

### 2. Start the System

```bash
./scripts/docker-start.sh
```

This will:
- Start PostgreSQL and Redis
- Run database migrations
- Start app and worker services
- Perform health checks

### 3. Access the System

- **Dashboard**: http://localhost:3002/dashboard.html
- **App Service API**: http://localhost:3002
- **Worker Service API**: http://localhost:3003

## ⚖️ Horizontal Scaling

### Scale Workers

Scale to 3 worker instances:
```bash
./scripts/docker-scale.sh 3
```

Scale down to 1 worker:
```bash
./scripts/docker-scale.sh 1
```

Stop all workers:
```bash
./scripts/docker-scale.sh 0
```

### Auto-scaling Simulation

The system includes auto-scaling logic that can be triggered by:
- Queue size thresholds
- CPU/memory usage
- Manual triggers via API

Monitor scaling events in the dashboard or via API:
```bash
curl http://localhost:3002/health/scaling-events
```

## 📊 Monitoring

### View Logs

All services:
```bash
./scripts/docker-logs.sh --follow
```

Specific service:
```bash
./scripts/docker-logs.sh --worker --follow
./scripts/docker-logs.sh --app --follow
```

### Health Checks

App service health:
```bash
curl http://localhost:3002/health
```

Worker service health:
```bash
curl http://localhost:3003/health
```

Detailed health with environment info:
```bash
curl http://localhost:3002/health/ready
curl http://localhost:3003/health/detailed
```

### Service Status

```bash
docker-compose ps
```

## 🛑 Stopping the System

### Graceful Stop
```bash
./scripts/docker-stop.sh
```

### Stop and Remove Volumes (⚠️ Data Loss)
```bash
./scripts/docker-stop.sh --volumes
```

### Stop and Remove Everything
```bash
./scripts/docker-stop.sh --all
```

## 🔧 Configuration

### Environment Variables

Key environment variables (see `.env.docker`):

```bash
# Database
DATABASE_URL=postgresql://async_task_user:async_task_password@postgres:5432/async_task_db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Services
APP_SERVICE_PORT=3002
WORKER_SERVICE_PORT=3003

# Worker Configuration
WORKER_NODE_ID=worker-docker-1
WORKER_CONCURRENCY=5
SCALING_MODE=false

# Auto-scaling
AUTO_SCALING_ENABLED=true
SCALE_UP_THRESHOLD=50
SCALE_DOWN_THRESHOLD=10
MIN_WORKERS=1
MAX_WORKERS=10
```

### Custom Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Modify `.env` with your settings

3. Restart services:
   ```bash
   ./scripts/docker-stop.sh
   ./scripts/docker-start.sh
   ```

## 🐛 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check if ports are in use
netstat -tulpn | grep -E ':(3002|3003|5432|6379)'

# Check Docker resources
docker system df
docker system prune  # Clean up if needed
```

**Database connection issues:**
```bash
# Check PostgreSQL logs
./scripts/docker-logs.sh --postgres

# Test connection manually
docker-compose exec postgres psql -U async_task_user -d async_task_db -c "SELECT 1;"
```

**Worker scaling issues:**
```bash
# Check worker logs
./scripts/docker-logs.sh --worker

# Check scaling events
curl http://localhost:3002/health/scaling-events
```

### Reset Everything

```bash
./scripts/docker-stop.sh --all
docker system prune -f
./scripts/docker-build.sh
./scripts/docker-start.sh
```

## 📈 Performance Tuning

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  worker-service:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Database Optimization

For production, consider:
- Using external PostgreSQL instance
- Configuring connection pooling
- Setting up read replicas

### Redis Optimization

For high throughput:
- Use Redis Cluster
- Configure persistence settings
- Tune memory usage

## 🔒 Security Considerations

### Production Deployment

1. **Change default passwords**:
   ```bash
   # Update .env with secure passwords
   POSTGRES_PASSWORD=your_secure_password
   REDIS_PASSWORD=your_redis_password
   ```

2. **Use secrets management**:
   ```yaml
   # docker-compose.yml
   services:
     postgres:
       environment:
         POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
       secrets:
         - postgres_password
   ```

3. **Network security**:
   - Use custom Docker networks
   - Restrict port exposure
   - Enable TLS for external connections

4. **Container security**:
   - Run as non-root user (already configured)
   - Use minimal base images
   - Regular security updates

## 📚 Additional Resources

- [Docker Compose Reference](https://docs.docker.com/compose/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
