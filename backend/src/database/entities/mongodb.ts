import { Entity, ObjectIdColumn, Column, Index, ObjectId } from 'typeorm';

@Entity('users')
@Index(['email'], { unique: true })
export class UserEntityMongo {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  email!: string;

  @Column()
  name!: string;

  @Column()
  passwordHash!: string;

  @Column({ default: false })
  isAdmin!: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

@Entity('documents')
@Index(['userId'])
@Index(['createdAt'])
export class DocumentEntityMongo {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  userId!: string;

  @Column()
  title!: string;

  @Column()
  filename!: string;

  @Column()
  mimeType!: string;

  @Column()
  fileSize!: number;

  @Column()
  filePath!: string;

  @Column({ default: 'pending' })
  processingStatus!: 'pending' | 'processing' | 'ready' | 'failed';

  @Column({ nullable: true })
  statusMessage?: string;

  @Column({ default: 0 })
  chunkCount!: number;

  @Column({ nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}

@Entity('document_chunks')
@Index(['documentId'])
@Index(['userId'])
export class DocumentChunkEntityMongo {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  documentId!: string;

  @Column()
  userId!: string;

  @Column()
  content!: string;

  @Column()
  chunkIndex!: number;

  @Column()
  tokens!: number;

  @Column({ type: 'simple-array' })
  embedding!: number[];

  @Column({ nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

@Entity('query_history')
@Index(['userId'])
@Index(['createdAt'])
export class QueryHistoryEntityMongo {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  userId!: string;

  @Column()
  query!: string;

  @Column({ nullable: true })
  documentIds?: string[];

  @Column()
  response!: string;

  @Column({ type: 'simple-array' })
  usedChunkIds!: string[];

  @Column({ nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}

@Entity('sessions')
@Index(['userId'])
@Index(['expiresAt'])
export class SessionEntityMongo {
  @ObjectIdColumn()
  _id!: ObjectId;

  @Column()
  userId!: string;

  @Column()
  token!: string;

  @Column()
  refreshToken!: string;

  @Column()
  expiresAt!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
