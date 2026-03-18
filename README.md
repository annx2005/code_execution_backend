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
   *Note: Ensure ports 3000 (API), 5432 (PostgreSQL), and 6379 (Redis) are available.*

The API server will run at http://localhost:3000.

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
npm install

# Run basic tests
npm run test
```

## Future Improvements

If given more time, the following areas would be improved:
- **WebSocket Integration**: Replace REST polling with WebSockets or Server-Sent Events (SSE) for real-time streaming of execution status and output as it runs.
- **Enhanced Code Isolation**: Implement a more robust sandbox like gVisor or Firecracker microVMs instead of raw Docker containers to provide kernel-level isolation.
- **Pre-warmed Containers**: Create an active pool of running containers to eliminate the cold start overhead when executing user code.
- **Advanced Rate Limiting**: Implement stricter rate limiting per user (using Redis) to prevent abuse of the execution API.
- **Caching Autosaves**: Place Redis caching in front of the Autosave PATCH endpoint to alleviate direct load on PostgreSQL.
