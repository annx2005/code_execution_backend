import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CodeSession } from './entities/code-session.entity';
import { Repository } from 'typeorm';
import { CreateCodeSessionDto } from './dto/create-code-session.dto';
import { UpdateCodeSessionDto } from './dto/update-code-session.dto';
import { HELLO_WORLD_TEMPLATES } from './constants/hello-world-templates';
import { ExecutionsService } from '../executions/executions.service';

@Injectable()
export class CodeSessionsService {
  constructor(
    @InjectRepository(CodeSession)
    private readonly codeSessionRepository: Repository<CodeSession>,
    private readonly executionsService: ExecutionsService,
  ) {}

  async create(dto: CreateCodeSessionDto) {
    const session = this.codeSessionRepository.create({
      language: dto.language,
      user_id: dto.userId,
      source_code: HELLO_WORLD_TEMPLATES[dto.language],
    });
    const result = await this.codeSessionRepository.save(session);
    return {
      session_id: result.id,
      status: result.status,
    };
  }

  async autosave(id: string, dto: UpdateCodeSessionDto) {
    await this.codeSessionRepository.update(id, dto);
    const result = await this.codeSessionRepository.findOne({ where: { id } });
    if (!result) throw new NotFoundException(`Code session ${id} not found`);
    return {
      session_id: result.id,
      status: result.status,
    };
  }

  async run(id: string) {
    const session = await this.codeSessionRepository.findOne({ where: { id } });
    if (!session) throw new NotFoundException(`Code session ${id} not found`);
    const result = await this.executionsService.run({
      session_id: id,
      code: session.source_code,
      language: session.language,
    });
    return result;
  }
}
