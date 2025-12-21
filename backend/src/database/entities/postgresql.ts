import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
@Index(['email'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ type: 'varchar', enum: ['admin', 'user'], default: 'user' })
  role!: 'admin' | 'user';

  @Column({ default: false })
  verified!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('documents')
@Index(['userId', 'createdAt'])
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  filename!: string;

  @Column()
  originalName!: string;

  @Column()
  mimeType!: string;

  @Column({ type: 'bigint' })
  size!: number;

  @Column({ nullable: true })
  s3Key?: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @Column({ default: 0 })
  chunkCount!: number;

  @Column({ type: 'varchar', default: 'pending' })
  processingStatus!: 'pending' | 'processing' | 'ready' | 'failed';

  @Column({ type: 'text', nullable: true })
  statusMessage?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('document_chunks')
@Index(['documentId'])
@Index(['userId'])
export class DocumentChunkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  documentId!: string;

  @Column()
  userId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'float8', array: true, nullable: true })
  embedding?: number[];

  @Column({ nullable: true })
  pageNumber?: number;

  @Column()
  chunkIndex!: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  vectorStoreId?: string;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('document_chunk_vectors')
@Index(['documentId'])
@Index(['userId'])
export class DocumentChunkVectorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  documentChunkId!: string;

  @Column()
  documentId!: string;

  @Column()
  userId!: string;

  @Column({ type: 'vector' as any })
  embedding!: number[];

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('document_ingestion_jobs')
@Index(['documentId'])
@Index(['userId'])
@Index(['jobId'], { unique: true })
export class DocumentIngestionJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id' })
  documentId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'job_id', type: 'varchar' })
  jobId!: string;

  @Column({ type: 'varchar' })
  status!: 'queued' | 'processing' | 'completed' | 'failed';

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'started_at', type: 'timestamp with time zone', nullable: true })
  startedAt?: Date;

  @Column({ name: 'finished_at', type: 'timestamp with time zone', nullable: true })
  finishedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('query_history')
@Index(['userId', 'createdAt'])
export class QueryHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column({ type: 'text' })
  query!: string;

  @Column({ type: 'text', array: true })
  documentIds!: string[];

  @Column({ type: 'text' })
  response!: string;

  @Column({
    type: 'jsonb',
    default: []
  })
  citations!: Array<{ documentId: string; text: string; pageNumber?: number }>;

  @Column({ type: 'numeric' })
  confidence!: number;

  @Column()
  executionTimeMs!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('sessions')
@Index(['token'], { unique: true })
@Index(['expiresAt'])
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Column()
  token!: string;

  @Column({ nullable: true })
  refreshToken?: string;

  @Column()
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
