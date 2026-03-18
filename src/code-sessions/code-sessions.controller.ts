import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { CodeSessionsService } from './code-sessions.service';
import { CreateCodeSessionDto } from './dto/create-code-session.dto';
import { UpdateCodeSessionDto } from './dto/update-code-session.dto';

@Controller('code-sessions')
export class CodeSessionsController {
  constructor(private readonly codeSessionsService: CodeSessionsService) {}

  @Post()
  create(@Body() body: CreateCodeSessionDto) {
    return this.codeSessionsService.create(body);
  }

  @Patch(':id')
  autosave(@Param('id') id: string, @Body() body: UpdateCodeSessionDto) {
    return this.codeSessionsService.autosave(id, body);
  }

  @Post(':id/run')
  run(@Param('id') id: string) {
    return this.codeSessionsService.run(id);
  }
}
