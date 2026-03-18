import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('CodeSessionsController - Failure Scenarios (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Enable ValidationPipe to test DTO validation
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Validation Failures', () => {
    it('POST /code-sessions - should fail if language is unsupported', async () => {
      const response = await request(app.getHttpServer())
        .post('/code-sessions')
        .send({ language: 'UNSUPPORTED_LANG', userId: 'user-123' })
        .expect(400);

      expect(response.body.message).toContain(
        'language must be one of the following values',
      );
    });

    it('POST /code-sessions - should fail if payload is missing', async () => {
      const response = await request(app.getHttpServer())
        .post('/code-sessions')
        .send({}) // Missing everything
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('language')]),
      );
    });

    it('PATCH /code-sessions/:id - should fail if source_code is missing in autosave', async () => {
      // Mock UUID để valid params (chưa quan tâm ID thật)
      const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app.getHttpServer())
        .patch(`/code-sessions/${mockUUID}`)
        .send({ language: 'PYTHON' }) // Thiếu source_code
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('source_code')]),
      );
    });
  });

  describe('2. Object Not Found Failures', () => {
    it('PATCH /code-sessions/:id - should return 404 if session not exist', async () => {
      const randomUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app.getHttpServer())
        .patch(`/code-sessions/${randomUUID}`)
        .send({ source_code: 'print("Hello")', language: 'PYTHON' })
        .expect(404);

      expect(response.body.message).toContain(
        `Code session ${randomUUID} not found`,
      );
    });

    it('POST /code-sessions/:id/run - should return 404 if session not exist', async () => {
      const randomUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app.getHttpServer())
        .post(`/code-sessions/${randomUUID}/run`)
        .send()
        .expect(404);

      expect(response.body.message).toContain(
        `Code session ${randomUUID} not found`,
      );
    });
  });

  describe('3. Queue / Worker Failure Scenarios (Mocked)', () => {
    it('POST /code-sessions/:id/run - API should fail gracefully if Redis is down (Queue error)', async () => {
      // TẠO 1 Session thật trước
      const sessionRes = await request(app.getHttpServer())
        .post('/code-sessions')
        .send({ language: 'PYTHON', userId: 'user-123' })
        .expect(201);

      const sessionId = sessionRes.body.session_id;

      // TODO: Ở đây trong hệ thống thực tế ta sẽ mock service `this.queue.add` để ném ra error của Redis.
      // NestJS E2E thường mock Queue sử dụng module override.
      // ... (Phần mock cần override module queue trước initApp)
    });
  });
});
