import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { spawn } from 'child_process';
import { ExecutionsService } from './executions.service';
import { ExecutionStatus } from './enums/execution-status.enum';
import { getLanguageConfig } from './configs/language.config';

interface ExecutionJobData {
  execution_id: string;
  code: string;
  language: string;
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  timedOut: boolean;
}

@Processor('code_executions', {
  concurrency: 5,
})
export class ExecutionsWorker extends WorkerHost {
  private readonly logger = new Logger(ExecutionsWorker.name);

  constructor(private service: ExecutionsService) {
    super();
  }

  async process(job: Job<ExecutionJobData>): Promise<void> {
    const { execution_id, code, language } = job.data;

    this.logger.log(
      `[${execution_id}] Job picked up. Status QUEUED -> RUNNING`,
    );

    await this.service.update(execution_id, {
      status: ExecutionStatus.RUNNING,
      started_at: new Date(),
    });

    try {
      const result = await this.executeInDocker(code, language);
      const finalStatus = result.timedOut
        ? ExecutionStatus.TIMEOUT
        : ExecutionStatus.COMPLETED;

      this.logger.log(
        `[${execution_id}] Execution finished. Status RUNNING -> ${finalStatus}. Time: ${result.executionTimeMs}ms`,
      );

      await this.service.update(execution_id, {
        status: finalStatus,
        stdout: result.stdout,
        stderr: result.stderr,
        execution_time_ms: result.executionTimeMs,
        completed_at: new Date(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `[${execution_id}] Execution failed. Status RUNNING -> FAILED: ${errorMessage}`,
      );
      await this.service.update(execution_id, {
        status: ExecutionStatus.FAILED,
        stderr: `System Error: ${errorMessage}`,
        completed_at: new Date(),
      });
    }
  }

  private executeInDocker(
    sourceCode: string,
    language: string,
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const config = getLanguageConfig(language, sourceCode);

      const child = spawn('docker', [
        'run',
        '--rm',
        '--network',
        'none',
        '--memory',
        '128m',
        '--cpus',
        '0.5',
        config.image,
        ...config.cmd,
      ]);

      const timer = setTimeout(() => {
        timedOut = true;
        if (child.pid) {
          spawn('docker', ['stop', child.pid.toString()]);
        }
        child.kill('SIGKILL');
      }, 5000);

      child.stdout.on('data', (data: Buffer) => {
        if (stdout.length < 100000) stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        if (stderr.length < 100000) stderr += data.toString();
      });

      child.on('close', () => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          executionTimeMs: Date.now() - startTime,
          timedOut,
        });
      });
    });
  }
}
