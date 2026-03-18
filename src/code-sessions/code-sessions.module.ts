import { Module } from '@nestjs/common';
import { CodeSessionsService } from './code-sessions.service';
import { CodeSessionsController } from './code-sessions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CodeSession } from './entities/code-session.entity';
import { ExecutionsModule } from '../executions/executions.module';

@Module({
  imports: [TypeOrmModule.forFeature([CodeSession]), ExecutionsModule],
  controllers: [CodeSessionsController],
  providers: [CodeSessionsService],
})
export class CodeSessionsModule {}
