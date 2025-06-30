# Distributed Async Task Queue System

A production-ready, horizontally scalable distributed async task queue system built with NestJS, featuring advanced task management, auto-scaling, CRON job scheduling, Dead Letter Queue (DLQ) pattern, and comprehensive monitoring dashboard.

## 🌟 Introduction

This system provides a robust solution for managing asynchronous tasks in distributed environments. It separates concerns between task coordination (app-service) and task processing (worker-service), enabling independent scaling and deployment. The architecture supports complex workflows, automatic retry mechanisms, performance monitoring, and intelligent auto-scaling based on queue load.

## 🏗️ System Architecture

### Core Components

- **App Service**: REST API, dashboard UI, task coordination, workflow management, CRON scheduling, and system monitoring
- **Worker Service**: Task processing engine, queue management, performance metrics collection (horizontally scalable)
- **Shared Package**: Common utilities, types, database schema, and business logic
- **PostgreSQL**: Primary database for persistent data, task history, and scaling events
- **Redis**: High-performance message queue and caching layer

### Architecture Diagram

![Architecture Diagram](./architecture-diagram.png)

## 🚀 Quick Start

## Prerequisites

Before running this project, make sure you have the following installed:

- [Node.js] (v22.16.x or later recommended)
  
### Option 1: Local Development (Recommended for Testing)

```bash
# Install all dependencies
npm install

# Start Redis (required)
npm run redis:start

# Set up database schema
npm run prisma:generate
npm run prisma:push

# Start both services in development mode
npm run dev

# Or start services individually
npm run start:app    # App service on port 3002
npm run start:worker # Worker service on port 3003
```

### Option 2: Docker

```bash
# Build and start the entire system
./scripts/docker-build.sh
./scripts/docker-start.sh

# Access the dashboard
open http://localhost:3002/dashboard.html

# Scale workers dynamically
./scripts/docker-scale.sh 3  # Scale to 3 worker instances

# Monitor system logs
./scripts/docker-logs.sh

# Stop the system
./scripts/docker-stop.sh
```

**Access Points:**

- 📊 Dashboard: http://localhost:3002/dashboard.html
- 🔧 App Service API: http://localhost:3002
- ⚙️ Worker Service API: http://localhost:3003

## � Comprehensive Dashboard

Access the sophisticated monitoring dashboard at `http://localhost:3002/dashboard.html` featuring:

![Architecture Diagram](./assets/images/1.png)
![Architecture Diagram](./assets/images/2.png)
![Architecture Diagram](./assets/images/3.png)
![Architecture Diagram](./assets/images/4.png)

### Real-time Monitoring (2-second refresh)

- **Task Status Trends**: Visual charts showing task completion rates
- **Queue Statistics**: Active, waiting, completed, failed, and delayed tasks
- **Performance Metrics**: Processing time, throughput (tasks/second)
- **System Health**: Database and Redis connection status

### Worker Management

- **Active Node Count**: Real-time worker node monitoring
- **Scaling Events**: Last 5 auto-scaling actions with timestamps
- **Node Performance**: CPU, memory usage, and task distribution

### Advanced Features

- **CRON Job Analytics**: Execution history, success rates, and scheduling
- **Dead Letter Queue**: Failed tasks with retry history and error details
- **Stress Testing**: Built-in load testing with dependent task support
- **Workflow Visualization**: Task dependencies and execution flow

## 🎯 Key Features & Functionalities

### 1. Task Management

- **Asynchronous Processing**: Non-blocking task execution with priority queues
- **Retry Mechanism**: Exponential backoff with configurable max attempts (default: 3)
- **Task Dependencies**: Support for complex workflows with dependent tasks
- **Bulk Operations**: Efficient batch task creation and processing
- **Task Prioritization**: Priority-based queue processing

### 2. CRON Job Scheduling

- **Automated Scheduling**: Built-in CRON job manager with standard cron expressions
- **System Health Checks**: Periodic health monitoring (every 5 minutes)
- **Database Cleanup**: Automated cleanup of old tasks and logs (daily at 2 AM)
- **Custom CRON Jobs**: Easy addition of custom scheduled tasks
- **Execution Tracking**: Complete history of CRON job executions

### 3. Dead Letter Queue (DLQ) Pattern

- **Failed Task Management**: Automatic handling of tasks that fail after all retries
- **Error Analysis**: Detailed error logs and stack traces
- **Retry History**: Complete audit trail of all retry attempts
- **Manual Reprocessing**: Admin interface for reprocessing failed tasks
- **Failure Classification**: Categorized failure reasons for better debugging

### 4. Auto-Scaling System

- **Intelligent Scaling**: Automatic worker scaling based on queue load
- **Configurable Thresholds**: Scale up at 50+ pending tasks, scale down at <10 tasks
- **Cooldown Periods**: Prevents rapid scaling oscillations
- **Resource Limits**: Configurable min (1) and max (10) worker limits
- **Scaling Events**: Complete audit log of all scaling decisions

### 5. Performance Monitoring

- **Real-time Metrics**: Live performance data collection every 30 seconds
- **Throughput Analysis**: Tasks per second and processing time metrics
- **Resource Monitoring**: CPU and memory usage tracking per worker
- **Historical Data**: Long-term performance trend analysis
- **Alert System**: Configurable alerts for performance thresholds

## � Docker Deployment

### Services Architecture

| Service            | Port  | Description                       | Scalable |
| ------------------ | ----- | --------------------------------- | -------- |
| **App Service**    | 3002  | REST API, Dashboard, Coordination | No       |
| **Worker Service** | 3003+ | Task Processing Engine            | Yes      |
| **PostgreSQL**     | 5432  | Primary Database                  | No       |
| **Redis**          | 6379  | Message Queue & Cache             | No       |

### Docker Features

- **Multi-stage Builds**: Optimized production images
- **Health Checks**: Built-in readiness and liveness probes
- **Graceful Shutdown**: Proper cleanup and task completion
- **Resource Management**: Configurable CPU and memory limits
- **Network Isolation**: Secure internal communication
- **Volume Persistence**: Data persistence across restarts

### Scaling Commands

```bash
# Scale to 5 workers
./scripts/docker-scale.sh 5

# Monitor scaling events
curl http://localhost:3002/health/scaling-events

# View worker health
curl http://localhost:3003/health/detailed

# Check container status
docker ps --filter "name=async-task"
```

## 📁 Project Structure

```
distributed-async-task-worker/
├── services/
│   ├── app-service/              # API & Dashboard Service
│   │   ├── src/
│   │   │   ├── api/             # REST API endpoints
│   │   │   ├── core/            # Auto-scaling, DLQ services
│   │   │   ├── cron/            # CRON job management
│   │   │   └── health/          # Health check endpoints
│   │   ├── Dockerfile           # App service container
│   │   └── package.json         # App dependencies
│   │
│   └── worker-service/           # Task Processing Service
│       ├── src/
│       │   ├── core/            # Worker core logic
│       │   ├── queue/           # Queue management
│       │   └── processors/      # Task processors
│       ├── Dockerfile           # Worker service container
│       └── package.json         # Worker dependencies
│
├── packages/
│   └── shared/                   # Shared Libraries
│       ├── src/
│       │   ├── services/        # Common services
│       │   ├── types/           # TypeScript types
│       │   └── utils/           # Utility functions
│       └── prisma/
│           └── schema.prisma    # Database schema
│
├── scripts/                      # Automation Scripts
│   ├── docker-build.sh         # Build Docker images
│   ├── docker-start.sh         # Start system
│   ├── docker-scale.sh         # Scale workers
│   ├── docker-stop.sh          # Stop system
│   └── start-redis.sh          # Local Redis setup
│
├── docker-compose.yml           # Main orchestration
├── docker-compose.scale.yml     # Scaling configuration
├── dashboard.html               # Monitoring dashboard
└── package.json                 # Root workspace config
```

## 🔧 Configuration

### Environment Variables

| Variable                      | Default        | Description                       |
| ----------------------------- | -------------- | --------------------------------- |
| `DATABASE_URL`                | -              | PostgreSQL connection string      |
| `REDIS_HOST`                  | localhost      | Redis hostname                    |
| `REDIS_PORT`                  | 6379           | Redis port                        |
| `REDIS_PASSWORD`              | -              | Redis authentication password     |
| `APP_SERVICE_PORT`            | 3002           | App service port                  |
| `WORKER_SERVICE_PORT`         | 3003           | Worker service port               |
| `WORKER_NODE_ID`              | auto-generated | Unique worker identifier          |
| `WORKER_CONCURRENCY`          | 5              | Concurrent tasks per worker       |
| `AUTO_SCALING_ENABLED`        | true           | Enable intelligent auto-scaling   |
| `SCALE_UP_THRESHOLD`          | 50             | Queue size to trigger scale up    |
| `SCALE_DOWN_THRESHOLD`        | 10             | Queue size to trigger scale down  |
| `MIN_WORKERS`                 | 1              | Minimum worker count              |
| `MAX_WORKERS`                 | 10             | Maximum worker count              |
| `QUEUE_REMOVE_ON_COMPLETE`    | 100            | Completed jobs to keep in memory  |
| `QUEUE_REMOVE_ON_FAIL`        | 50             | Failed jobs to keep in memory     |
| `METRICS_COLLECTION_INTERVAL` | 30000          | Performance metrics interval (ms) |
| `HEARTBEAT_INTERVAL`          | 10000          | Worker heartbeat interval (ms)    |

### Configuration Files

- `.env` - Local development environment
- `.env.docker` - Docker-specific configuration
- `docker-compose.yml` - Main orchestration file
- `docker-compose.scale.yml` - Scaling configuration
- `packages/shared/prisma/schema.prisma` - Database schema

### Local Development Setup

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/async_task_db"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Service Ports
APP_SERVICE_PORT=3002
WORKER_SERVICE_PORT=3003

# Worker Configuration
WORKER_NODE_ID=worker-local-1
WORKER_CONCURRENCY=5

# Auto-scaling Configuration
AUTO_SCALING_ENABLED=true
SCALE_UP_THRESHOLD=50
SCALE_DOWN_THRESHOLD=10
MIN_WORKERS=1
MAX_WORKERS=10

# Queue Configuration
QUEUE_REMOVE_ON_COMPLETE=100
QUEUE_REMOVE_ON_FAIL=50

# Monitoring Configuration
METRICS_COLLECTION_INTERVAL=30000
HEARTBEAT_INTERVAL=10000
```

## 📚 API Documentation

### Task Management Endpoints

```bash
# Create a new task
POST /tasks
Content-Type: application/json
{
  "name": "Process Data",
  "type": "data-processing",
  "payload": { "data": "example" },
  "priority": 1,
  "delay": 0
}

# Get task list with pagination
GET /tasks?page=1&limit=10&status=PENDING

# Get specific task details
GET /tasks/:id

# Cancel a task
DELETE /tasks/:id

# Get task statistics
GET /tasks/stats
```

### Workflow Management Endpoints

```bash
# Create a workflow
POST /workflows
{
  "name": "Data Pipeline",
  "description": "Process and analyze data",
  "tasks": [...]
}

# Execute a workflow
POST /workflows/:id/execute

# Get workflow status
GET /workflows/:id/status
```

### System Monitoring Endpoints

```bash
# System health check
GET /health

# Detailed health information
GET /health/detailed

# Queue statistics
GET /health/queue

# Scaling events history
GET /health/scaling-events

# Performance metrics
GET /system/performance/summary

# Worker node status
GET /system/nodes

# Auto-scaling configuration
GET /auto-scaling/config
POST /auto-scaling/config
```

### CRON Job Management Endpoints

```bash
# List CRON jobs
GET /cron/jobs

# Create CRON job
POST /cron/jobs
{
  "name": "Daily Cleanup",
  "schedule": "0 2 * * *",
  "taskType": "cleanup",
  "enabled": true
}

# Get CRON job executions
GET /cron/jobs/:id/executions

# Enable/disable CRON job
PATCH /cron/jobs/:id
```

### Dead Letter Queue Endpoints

```bash
# Get DLQ tasks
GET /dlq/tasks

# Reprocess DLQ task
POST /dlq/tasks/:id/reprocess

# Get DLQ statistics
GET /dlq/stats
```

## 🏆 Architecture Benefits

### 1. Scalability & Performance

- **Horizontal Scaling**: Independent scaling of worker nodes based on demand
- **Load Distribution**: Intelligent task distribution across multiple workers
- **Resource Optimization**: Efficient resource utilization with auto-scaling
- **High Throughput**: Concurrent task processing with configurable concurrency levels

### 2. Reliability & Fault Tolerance

- **Retry Mechanisms**: Exponential backoff with configurable retry attempts
- **Dead Letter Queue**: Graceful handling of permanently failed tasks
- **Health Monitoring**: Continuous health checks and automatic recovery
- **Data Persistence**: PostgreSQL ensures data durability and consistency

### 3. Operational Excellence

- **Monitoring & Observability**: Comprehensive dashboard with real-time metrics
- **Automated Operations**: CRON jobs for maintenance and health checks
- **Event Logging**: Complete audit trail of all system events
- **Performance Analytics**: Historical data and trend analysis

### 4. Developer Experience

- **Monorepo Architecture**: Shared code and consistent development experience
- **TypeScript Support**: Type safety across all services
- **Docker Integration**: Consistent development and production environments
- **Comprehensive Testing**: Built-in testing framework and utilities

### 5. Enterprise Ready

- **Security**: Environment-based configuration and secure communication
- **Compliance**: Complete audit logs and data retention policies
- **Integration**: RESTful APIs for easy integration with existing systems
- **Documentation**: Comprehensive documentation and examples

## 🚀 Further Improvements & Roadmap

### Short-term Enhancements

- [ ] **WebSocket Support**: Real-time dashboard updates without polling
- [ ] **Task Scheduling UI**: Visual CRON job editor in the dashboard
- [ ] **Advanced Filtering**: Enhanced task filtering and search capabilities
- [ ] **Bulk Operations**: Batch task management operations
- [ ] **Export Functionality**: Export task data and reports

### Medium-term Features

- [ ] **Multi-tenant Support**: Isolated workspaces for different teams
- [ ] **Advanced Workflows**: Visual workflow builder with conditional logic
- [ ] **Plugin System**: Extensible architecture for custom task processors
- [ ] **Metrics Export**: Prometheus/Grafana integration
- [ ] **Alert Management**: Configurable alerts and notifications

### Long-term Vision

- [ ] **Kubernetes Support**: Native Kubernetes deployment and scaling
- [ ] **Multi-region Deployment**: Geographic distribution for global scale
- [ ] **Machine Learning**: Predictive scaling based on historical patterns
- [ ] **Advanced Security**: Role-based access control and encryption
- [ ] **API Gateway**: Centralized API management and rate limiting

## 🧪 Testing & Quality Assurance

### Testing Framework

The project uses **Jest** and **Supertest** for comprehensive testing:

- **Unit Tests**: Test individual components and services in isolation
- **Integration Tests**: Test API endpoints and service interactions
- **E2E Tests**: End-to-end testing of complete workflows
- **Mocking**: Comprehensive mocking of external dependencies

### Testing Strategy

```bash
# Run all tests (unit + e2e)
npm run test:all

# Run unit tests only
npm run test:unit
npm run test:app      # App service unit tests
npm run test:worker   # Worker service unit tests

# Run E2E tests
npm run test:e2e
npm run test:e2e:app    # App service E2E tests
npm run test:e2e:worker # Worker service E2E tests

# Run tests with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Individual service testing
npm test --workspace=services/app-service
npm test --workspace=services/worker-service
```

### Test Coverage Areas

#### Unit Tests

- **Task Controller**: Task creation, retrieval, cancellation, and statistics
- **Auto-scaling Service**: Scaling logic, thresholds, and configuration
- **Queue Manager**: Task queuing, bulk operations, and queue statistics
- **Dead Letter Queue**: Failed task handling and reprocessing
- **CRON Job Manager**: Job scheduling and execution
- **Performance Metrics**: Data collection and analysis

#### E2E Tests

- **Task API**: Complete task lifecycle testing
- **Health Endpoints**: System health and monitoring
- **Worker Health**: Worker-specific health checks and metrics
- **System Integration**: Database and Redis connectivity
- **Error Handling**: Proper error responses and status codes

### Test Environment Setup

```bash
# Set up test database (optional - uses in-memory by default)
export TEST_DATABASE_URL="postgresql://<user_name>:<password>@localhost:5432/<db_name>"

# Run tests with custom environment
NODE_ENV=test npm run test:all
```

### Quality Metrics

- **Code Coverage**: >90% test coverage across all services
- **Performance**: <100ms average task processing time
- **Reliability**: 99.9% uptime with proper monitoring
- **Scalability**: Tested up to 1000+ concurrent tasks
- **Test Execution**: All tests complete in <30 seconds

## 🚨 Troubleshooting

### Common Issues

**Port conflicts:**

```bash
# Check port usage
netstat -tulpn | grep -E ':(3002|3003|5432|6379)'

# Kill processes using ports
sudo lsof -ti:3002 | xargs kill -9
```

**Database connection issues:**

```bash
# Reset database
./scripts/docker-stop.sh --volumes
./scripts/docker-start.sh

# Check database logs
docker logs async-task-postgres
```

**Redis connection problems:**

```bash
# Test Redis connection
redis-cli ping

# Restart Redis
docker restart async-task-redis
```

**Worker scaling issues:**

```bash
# Check scaling events
curl http://localhost:3002/health/scaling-events

# View worker logs
./scripts/docker-logs.sh

# Manual scaling
./scripts/docker-scale.sh 3
```

### Performance Optimization

**Database Performance:**

- Regular database maintenance and cleanup
- Proper indexing on frequently queried columns
- Connection pooling optimization

**Redis Performance:**

- Memory usage monitoring
- Key expiration policies
- Connection pool tuning

**Worker Performance:**

- Concurrency level tuning
- Resource allocation optimization
- Task processing optimization

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies: `npm install`
4. Start development environment: `npm run dev`
5. Make your changes and add tests
6. Run tests: `npm test`
7. Commit changes: `git commit -m 'Add amazing feature'`
8. Push to branch: `git push origin feature/amazing-feature`
9. Submit a pull request

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with Prettier formatting
- **Testing**: Comprehensive test coverage required
- **Documentation**: Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/) framework
- Queue management powered by [BullMQ](https://docs.bullmq.io/)
- Database ORM using [Prisma](https://www.prisma.io/)
- Containerization with [Docker](https://www.docker.com/)
- Monitoring dashboard with vanilla JavaScript and Chart.js
