# Live Code Execution - Architecture & Design Decisions

## 1. Architecture Overview

### End-to-End Request Flow
1. **Code Session Creation**: Client POSTs to `/code-sessions` to initialize a coding session. The system returns an ACTIVE session status along with the boilerplate code snippet based on the requested language.
2. **Autosave Behavior**: As the learner writes code, the frontend sends periodic `PATCH` requests to `/code-sessions/{session_id}` to save the current source code snapshot into the PostgreSQL database.
3. **Execution Request**: When the learner clicks "Run", the frontend triggers `POST /code-sessions/{session_id}/run`.
4. **Background Execution**: The API offloads the execution job to a BullMQ Redis queue, returning an `execution_id` with `QUEUED` status immediately without delaying the HTTP response.
5. **Result Polling**: A NestJS worker process picks up the job from the queue. It spawns an isolated Docker container, executes the user's code securely, captures outputs/errors, and updates the database. The client polls `GET /executions/{execution_id}` to track the lifecycle: `QUEUED` -> `RUNNING` -> `COMPLETED`/`FAILED`/`TIMEOUT`.

### Queue-Based Execution Design
Since code evaluation (compiling, container setup, execution) is an inherently slow and CPU/IO-bound task, processing executions synchronously within a regular HTTP request cycle can block incoming requests, leading to an unresponsive API. Offloading to Redis + BullMQ cleanly separates the REST API layer from the heavy lifting performed by Worker processes.

## 2. Reliability & Data Model

### Execution States & Lifecycle
- **QUEUED**: Job successfully added to the message queue.
- **RUNNING**: Worker has started the isolated execution environment.
- **COMPLETED**: Execution finished successfully within safety limits.
- **FAILED**: System anomalies, parsing errors, or container crash occurred.
- **TIMEOUT**: Infinite loops detected or resource constraints exceeded (5 second limit).

### Idempotency Handling & Safeties
To prevent duplicate execution runs if a user repeatedly clicks the "Run" button, the system can utilize the unique session_id to cancel previous QUEUED jobs or implement a rate-limit layer. The BullMQ system ensures safe reprocessing as executions are stateless.

### Failure Handling
- **Retries**: BullMQ is configured with backoff strategies for transient failures (e.g., Docker daemon blips).
- **Error States**: Syntax errors in user code are captured and returned in `stderr` while setting the execution status to COMPLETED.
- **Dead-letter Queues**: Jobs that exhaust all retry attempts are marked as FAILED for manual investigation, preventing them from blocking the queue.

### Isolation Strategy (Docker)
Executions spawn short-lived Alpine Linux containers (or optimized JDK/GCC images). Resource limits are strictly enforced via the Docker engine:
- CPU: 0.5 cores
- Memory: 128MB
- Network: Disabled (`--network none`)
- Time: 5 seconds

## 3. Scalability Considerations

- **Handling Concurrent Sessions (Non-blocking)**: Separation of API and Worker layers via BullMQ ensures the REST server remains responsive and handles high concurrency elegantly regardless of execution load, satisfying the non-blocking optional constraint. API explicitly offloads executions immediately.
- **Controlled Worker Concurrency**: The worker logic prevents host overload by strictly limiting the active jobs per worker process via BullMQ concurrency settings (`concurrency: 5`).
- **Horizontal Scaling**: Extra Worker nodes can be provisioned to consume jobs from the shared Redis queue as demand grows without any system modifications. 
- **Queue Backlog**: BullMQ absorbs sudden spikes in activity. If the backlog grows, workers pull jobs systematically without overwhelming the host system.
- **Potential Bottlenecks**: High-frequency patching via Autosave can thrash the PostgreSQL database. **Mitigation**: Implement a Write-Behind cache using Redis to aggregate snapshots before persisting to the DB.

## 4. Trade-offs

### Technology Choices & Why
- **NestJS/Node.js**: Provides a strongly typed, maintainable architecture with excellent built-in support for required modules like BullMQ and TypeORM.
- **Redis + BullMQ**: Offers ultra-fast in-memory processing for background task management.
- **PostgreSQL**: Reliable, ACID-compliant relational storage for core transactional data (Sessions and Executions).

### Design Priorities (Simplicity vs Absolute Performance)
- **Cold Starts**: Starting a new Docker container per execution introduces 500ms - 2000ms of latency. While V8 Isolates or pre-warmed container pools would be faster, raw Docker containers were chosen for this assignment for their simplicity and robustness across multiple languages.
- **Rest Polling**: Status changes are tracked via REST polling. While WebSockets provide lower latency, REST polling was chosen for the MVP to reduce architectural complexity while remaining reliable.

### Production Readiness Gaps
- **Infrastructure**: Running Docker-in-Docker via socket proxy works for this setup but would be replaced by Kubernetes Jobs or AWS Lambda in a high-scale production environment.
- **Security**: For true enterprise-grade security, additional layers like gVisor would be implemented to prevent container escape attempts.
