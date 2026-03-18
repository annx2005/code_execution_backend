import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution } from './entities/execution.entity';
import { ExecutionStatus } from './enums/execution-status.enum';

interface RunPayload {
  session_id: string;
  code: string;
  language: string;
}

@Injectable()
export class ExecutionsService {
  constructor(
    @InjectQueue('code_executions') private readonly queue: Queue,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
  ) {}

  async run({ session_id, code, language }: RunPayload) {
    // Idempotency: Prevent duplicate execution runs
    // Check if there is an ongoing (QUEUED or RUNNING) execution for the same session.
    // If so, return that existing execution instead of creating a new one.
    const ongoingExecution = await this.executionRepository.findOne({
      where: [
        { session_id, status: ExecutionStatus.QUEUED },
        { session_id, status: ExecutionStatus.RUNNING },
      ],
    });

    if (ongoingExecution) {
      return {
        execution_id: ongoingExecution.id,
        status: ongoingExecution.status,
      };
    }

    const execution = this.executionRepository.create({
      session_id,
      source_code: code,
      language: language,
      status: ExecutionStatus.QUEUED,
    });
    const savedExecution = await this.executionRepository.save(execution);

    await this.queue.add(
      'execute',
      {
        execution_id: savedExecution.id,
        session_id,
        code,
        language,
      },
      {
        jobId: savedExecution.id, // Idempotency metric for Redis Queue preventing duplicate jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s, 2s, 4s
        },
        removeOnComplete: true, // Auto-cleanup to save redis space
        removeOnFail: false, // Keep in redis for Dead Letter inspection
      },
    );

    return {
      execution_id: savedExecution.id,
      status: savedExecution.status,
    };
  }

  async update(id: string, payload: Partial<Execution>) {
    await this.executionRepository.update(id, payload);
  }

  async findOne(id: string) {
    const execution = await this.executionRepository.findOne({ where: { id } });
    if (!execution) {
      throw new NotFoundException(`Execution with id ${id} not found`);
    }
    return {
      execution_id: execution.id,
      status: execution.status,
      stdout: execution.stdout,
      stderr: execution.stderr,
      execution_time_ms: execution.execution_time_ms,
    };
  }
}
