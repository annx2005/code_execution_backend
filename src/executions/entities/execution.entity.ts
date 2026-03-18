import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CodeSession } from '../../code-sessions/entities/code-session.entity';
import { ExecutionStatus } from '../enums/execution-status.enum';

@Entity('executions')
export class Execution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CodeSession)
  @JoinColumn({ name: 'session_id' })
  session: CodeSession;

  @Column()
  session_id: string;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.QUEUED,
  })
  status: ExecutionStatus;

  @Column({ type: 'text', nullable: true })
  source_code: string;

  @Column({ nullable: true })
  language: string;

  @Column({ type: 'text', nullable: true })
  stdout: string;

  @Column({ type: 'text', nullable: true })
  stderr: string;

  @Column({ nullable: true })
  execution_time_ms: number;

  @CreateDateColumn()
  queued_at: Date;

  @Column({ nullable: true })
  started_at: Date;

  @Column({ nullable: true })
  completed_at: Date;

  @Column({ default: 0 })
  retry_count: number;
}
