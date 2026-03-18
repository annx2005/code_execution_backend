import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Execution } from '../src/executions/entities/execution.entity';
import { Repository } from 'typeorm';
import { Language } from '../src/code-sessions/enums/language.enum';
import { ExecutionStatus } from '../src/executions/enums/execution-status.enum';
import { ExecutionsWorker } from '../src/executions/executions.worker';

describe('ExecutionsWorker - Integration (e2e)', () => {
  let app: INestApplication;
  let executionRepo: Repository<Execution>;
  let sessionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    executionRepo = moduleFixture.get<Repository<Execution>>(
      getRepositoryToken(Execution),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create a new session for each test
    const sessionRes = await request(app.getHttpServer())
      .post('/code-sessions')
      .send({ language: Language.PYTHON })
      .expect(201);
    sessionId = sessionRes.body.session_id;
  });

  describe('Happy Cases', () => {
    it('should complete execution successfully', async () => {
      // 1. Update session with valid code
      await request(app.getHttpServer())
        .patch(`/code-sessions/${sessionId}`)
        .send({
          source_code: 'print("Hello Integration Test!")',
          language: Language.PYTHON,
        })
        .expect(200);

      // 2. Run execution
      const runRes = await request(app.getHttpServer())
        .post(`/code-sessions/${sessionId}/run`)
        .expect(201);

      const executionId = runRes.body.execution_id;
      expect(runRes.body.status).toBe(ExecutionStatus.QUEUED);

      // 3. Poll for completion (max 10 seconds)
      let status = ExecutionStatus.QUEUED;
      let getRes;
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        getRes = await request(app.getHttpServer())
          .get(`/executions/${executionId}`)
          .expect(200);

        status = getRes.body.status;
        if (
          status === ExecutionStatus.COMPLETED ||
          status === ExecutionStatus.FAILED ||
          status === ExecutionStatus.TIMEOUT
        ) {
          break;
        }
      }

      // 4. Assert results
      expect(status).toBe(ExecutionStatus.COMPLETED);
      expect(getRes.body.stdout).toContain('Hello Integration Test!');
      expect(getRes.body.stderr).toBe('');
      expect(getRes.body.execution_time_ms).toBeGreaterThan(0);
    }, 15000); // Increase timeout for Docker execution
  });

  describe('Failure Cases', () => {
    it('should handle syntax errors gracefully (COMPLETED with stderr)', async () => {
      await request(app.getHttpServer())
        .patch(`/code-sessions/${sessionId}`)
        .send({
          source_code: 'print("Missing closing quote)',
          language: Language.PYTHON,
        })
        .expect(200);

      const runRes = await request(app.getHttpServer())
        .post(`/code-sessions/${sessionId}/run`)
        .expect(201);

      const executionId = runRes.body.execution_id;

      let status = ExecutionStatus.QUEUED;
      let getRes;
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        getRes = await request(app.getHttpServer())
          .get(`/executions/${executionId}`)
          .expect(200);

        status = getRes.body.status;
        if (
          status === ExecutionStatus.COMPLETED ||
          status === ExecutionStatus.FAILED ||
          status === ExecutionStatus.TIMEOUT
        ) {
          break;
        }
      }

      expect(status).toBe(ExecutionStatus.COMPLETED);
      expect(getRes.body.stderr).toContain('SyntaxError');
    }, 15000);

    it('should handle timeouts for infinite loops (TIMEOUT)', async () => {
      await request(app.getHttpServer())
        .patch(`/code-sessions/${sessionId}`)
        .send({ source_code: 'while True: pass', language: Language.PYTHON })
        .expect(200);

      const runRes = await request(app.getHttpServer())
        .post(`/code-sessions/${sessionId}/run`)
        .expect(201);

      const executionId = runRes.body.execution_id;

      // Timeout is 5s, poll for max 10s
      let status = ExecutionStatus.QUEUED;
      let getRes;
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        getRes = await request(app.getHttpServer())
          .get(`/executions/${executionId}`)
          .expect(200);

        status = getRes.body.status;
        if (
          status === ExecutionStatus.COMPLETED ||
          status === ExecutionStatus.FAILED ||
          status === ExecutionStatus.TIMEOUT
        ) {
          break;
        }
      }

      expect(status).toBe(ExecutionStatus.TIMEOUT);
    }, 20000);

    it('should set status to FAILED if internal worker crash occurs (e.g. Docker daemon stops)', async () => {
      // Mock internal worker behavior to throw an exception
      const worker = app.get(ExecutionsWorker);
      const spy = jest
        .spyOn(worker as any, 'executeInDocker')
        .mockRejectedValueOnce(new Error('Simulated internal worker crash'));

      await request(app.getHttpServer())
        .patch(`/code-sessions/${sessionId}`)
        .send({
          source_code: 'print("Testing Crash")',
          language: Language.PYTHON,
        })
        .expect(200);

      const runRes = await request(app.getHttpServer())
        .post(`/code-sessions/${sessionId}/run`)
        .expect(201);

      const executionId = runRes.body.execution_id;

      let status = ExecutionStatus.QUEUED;
      let getRes;
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        getRes = await request(app.getHttpServer())
          .get(`/executions/${executionId}`)
          .expect(200);

        status = getRes.body.status;
        if (status === ExecutionStatus.FAILED) {
          break;
        }
      }

      expect(status).toBe(ExecutionStatus.FAILED);
      expect(getRes.body.stderr).toContain('Simulated internal worker crash');
      expect(spy).toHaveBeenCalled();
    }, 15000);
  });

  describe('Idempotency & Concurrent Execution', () => {
    it('should prevent duplicate execution runs for the same session (return existing active execution)', async () => {
      await request(app.getHttpServer())
        .patch(`/code-sessions/${sessionId}`)
        .send({
          source_code: 'import time; time.sleep(1); print("Idempotency Test")',
          language: Language.PYTHON,
        })
        .expect(200);

      // Send 3 run requests concurrently
      const promises = [
        request(app.getHttpServer()).post(`/code-sessions/${sessionId}/run`),
        request(app.getHttpServer()).post(`/code-sessions/${sessionId}/run`),
        request(app.getHttpServer()).post(`/code-sessions/${sessionId}/run`),
      ];

      const responses = await Promise.all(promises);

      // We expect idempotency to kick in: 
      // All requests should return 201 (since it's an asynchronous accepted job concept)
      // but they should all return the *same* execution_id because the first one locked the status to QUEUED
      
      const executionIds = new Set(
        responses.map((res) => res.body.execution_id),
      );
      
      expect(executionIds.size).toBe(1); // Only 1 distinct execution was created
      
      for (const res of responses) {
        expect(res.status).toBe(201);
        expect([ExecutionStatus.QUEUED, ExecutionStatus.RUNNING]).toContain(res.body.status);
        expect(res.body.execution_id).toBeDefined();
      }
    }, 15000);
  });
});
