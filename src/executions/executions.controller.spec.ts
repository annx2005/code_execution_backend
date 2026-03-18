import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';

describe('ExecutionsController', () => {
  let controller: ExecutionsController;
  let service: ExecutionsService;

  beforeEach(async () => {
    const mockService = {
      findOne: jest.fn().mockResolvedValue({
        execution_id: '123',
        status: 'COMPLETED',
        stdout: 'Hello World',
        stderr: '',
        execution_time_ms: 50,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecutionsController],
      providers: [
        {
          provide: ExecutionsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ExecutionsController>(ExecutionsController);
    service = module.get<ExecutionsService>(ExecutionsService);
  });

  it('should return execution result', async () => {
    const result = await controller.findOne('123');
    expect(result).toEqual({
      execution_id: '123',
      status: 'COMPLETED',
      stdout: 'Hello World',
      stderr: '',
      execution_time_ms: 50,
    });
  });
});
