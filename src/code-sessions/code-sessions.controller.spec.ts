import { Test, TestingModule } from '@nestjs/testing';
import { CodeSessionsController } from './code-sessions.controller';
import { CodeSessionsService } from './code-sessions.service';
import { Language } from './enums/language.enum';

describe('CodeSessionsController', () => {
  let controller: CodeSessionsController;
  let service: CodeSessionsService;

  beforeEach(async () => {
    const mockService = {
      create: jest
        .fn()
        .mockResolvedValue({ session_id: '123', status: 'ACTIVE' }),
      autosave: jest
        .fn()
        .mockResolvedValue({ session_id: '123', status: 'ACTIVE' }),
      run: jest.fn().mockResolvedValue({ session_id: '123', status: 'QUEUED' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CodeSessionsController],
      providers: [
        {
          provide: CodeSessionsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<CodeSessionsController>(CodeSessionsController);
    service = module.get<CodeSessionsService>(CodeSessionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create() should return a session', async () => {
    const result = await controller.create({ language: Language.PYTHON });
    expect(result).toEqual({ session_id: '123', status: 'ACTIVE' });
    expect(service.create).toHaveBeenCalledWith({ language: Language.PYTHON });
  });

  it('run() should return queued execution', async () => {
    const result = await controller.run('123');
    expect(result).toEqual({ session_id: '123', status: 'QUEUED' });
    expect(service.run).toHaveBeenCalledWith('123');
  });
});
