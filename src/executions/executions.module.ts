import { Module } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { ExecutionsController } from './executions.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Execution } from './entities/execution.entity';
import { BullModule } from '@nestjs/bullmq';
import { ExecutionsWorker } from './executions.worker';

@Module({
  imports: [
    TypeOrmModule.forFeature([Execution]),
    BullModule.registerQueue({
      name: 'code_executions',
    }),
  ],
  controllers: [ExecutionsController],
  providers: [ExecutionsService, ExecutionsWorker],
  exports: [ExecutionsService],
})
export class ExecutionsModule {}
