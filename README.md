# Job Simulation Platform - Live Code Execution

This is a backend system designed to enable live code execution within a Job Simulation platform. It provides learners the ability to write, validate, and execute code in an isolated environment directly from their simulation tasks.

## Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Node.js (v20+)
- Yarn

### Run the System

1. Clone the repository.
2. Build and start the infrastructure via Docker Compose:
   ```bash
   docker-compose up --build
   ```
   _Note: Ensure ports 3000 (API), 5432 (PostgreSQL), and 6379 (Redis) are available._

The API server will run at http://localhost:3000.

## Requirement Verification / Assignment Checklist
This project successfully fulfills the requirements from the Take-home Assignment:
- ✓ **Live Code Session APIs**: `POST /code-sessions` and `PATCH /code-sessions/{session_id}` work exactly as defined.
- ✓ **Execute Async**: `POST /code-sessions/{session_id}/run` adds jobs to BullMQ and returns immediately via an isolated API request.
- ✓ **Result Polling**: `GET /executions/{execution_id}` correctly polls states `QUEUED` -> `RUNNING` -> `COMPLETED`/`FAILED`/`TIMEOUT` mapped to DB logic.
- ✓ **Execution & Worker System**: Handled by BullMQ processing pool leveraging isolated container instantiation (Docker).
- ✓ **Safety Constraints**: CPU & Memory isolation through Docker configuration. Time limits set to terminate infinite loops after 5s.
- ✓ **Idempotency & Retries**: Queue checks existing db jobs natively. BullMQ natively respects defined Retry strategies (`backoff` exponent).
- ✓ **Handle high concurrency (optional)**: Effectively managed using scalable asynchronous queuing mechanics (BullMQ) resolving the Optional target. Rest API isn't blocked.
- ✓ **Fully Tested (Bonus)**: Both basic unit tests and detailed E2E (Simulating lifecycle, crash states, concurrency locks) are available to run against real containers.

## API Documentation

### 1. Code Sessions

**1.1 Create Session**

- **Endpoint**: `POST /code-sessions`
- **Body**:
  ```json
  {
    "language": "python", // Options: python, javascript, java, cpp, c
    "userId": "user-uuid" // Optional
  }
  ```
- **Response**: `201 Created`
  ```json
  { "session_id": "uuid", "status": "ACTIVE" }
  ```

**1.2 Autosave Session**

- **Endpoint**: `PATCH /code-sessions/{session_id}`
- **Body**:
  ```json
  {
    "language": "python",
    "source_code": "print('Hello World')"
  }
  ```
- **Response**: `200 OK`
  ```json
  { "session_id": "uuid", "status": "ACTIVE" }
  ```

**1.3 Execute Session Code (Async)**

- **Endpoint**: `POST /code-sessions/{session_id}/run`
- **Response**: `201 Created`
  ```json
  { "execution_id": "uuid", "status": "QUEUED" }
  ```

### 2. Code Executions

**2.1 Retrieve Execution Status**

- **Endpoint**: `GET /executions/{execution_id}`
- **Response**: `200 OK`
  ```json
  {
    "execution_id": "uuid",
    "status": "COMPLETED", // QUEUED, RUNNING, COMPLETED, FAILED, TIMEOUT
    "stdout": "Hello World\n",
    "stderr": "",
    "execution_time_ms": 120
  }
  ```

## System Architecture & Decisions

Please read [DESIGN.md](./DESIGN.md) for detailed explanations covering end-to-end flows, trade-offs, scalability, and design choices.

## Testing

```bash
# Install dependencies locally first
yarn install

# Run basic unit tests
yarn test

# Run e2e/integration tests (requires valid DB & Redis connection)
# 1. Start dependencies
docker-compose up -d postgres redis

# 2. Run the tests
yarn test:e2e

# 3. Clean up
docker-compose down
```

## Future Improvements

If given more time, the following areas would be improved:

- **WebSocket Integration**: Replace REST polling with WebSockets or Server-Sent Events (SSE) for real-time streaming of execution status and output as it runs.
- **Enhanced Code Isolation**: Implement a more robust sandbox like gVisor or Firecracker microVMs instead of raw Docker containers to provide kernel-level isolation.
- **Pre-warmed Containers**: Create an active pool of running containers to eliminate the cold start overhead when executing user code.
- **Advanced Rate Limiting**: Implement stricter rate limiting per user (using Redis) to prevent abuse of the execution API.
- **Caching Autosaves**: Place Redis caching in front of the Autosave PATCH endpoint to alleviate direct load on PostgreSQL.
