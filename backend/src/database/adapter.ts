import { DataSource, Repository, ObjectLiteral } from 'typeorm';
import { AppDataSource } from './connection';
import { MongoDataSource } from './mongo-connection';
import {
  UserEntity,
  DocumentEntity,
  DocumentChunkEntity,
  DocumentChunkVectorEntity,
  QueryHistoryEntity,
  SessionEntity,
  DocumentIngestionJobEntity,
} from './entities/postgresql';
import {
  UserEntityMongo,
  DocumentEntityMongo,
  DocumentChunkEntityMongo,
  QueryHistoryEntityMongo,
  SessionEntityMongo,
} from './entities/mongodb';

export type DatabaseType = 'postgres' | 'mongodb';

export class DatabaseAdapter {
  private static instance: DatabaseAdapter;
  private readonly activeDatabase: DataSource;
  private readonly databaseType: DatabaseType;

  private constructor() {
    this.databaseType = (process.env.DATABASE_TYPE || 'postgres') as DatabaseType;
    this.activeDatabase = this.databaseType === 'mongodb' ? MongoDataSource : AppDataSource;
  }

  static getInstance(): DatabaseAdapter {
    if (!DatabaseAdapter.instance) {
      DatabaseAdapter.instance = new DatabaseAdapter();
    }
    return DatabaseAdapter.instance;
  }

  getDataSource(): DataSource {
    return this.activeDatabase;
  }

  getDatabaseType(): DatabaseType {
    return this.databaseType;
  }

  async initialize(): Promise<void> {
    if (!this.activeDatabase.isInitialized) {
      await this.activeDatabase.initialize();
      console.log(`${this.databaseType.toUpperCase()} database initialized`);
    }
  }

  async close(): Promise<void> {
    if (this.activeDatabase.isInitialized) {
      await this.activeDatabase.destroy();
      console.log(`${this.databaseType.toUpperCase()} database connection closed`);
    }
  }

  getRepository<Entity extends ObjectLiteral>(
    entity: any
  ): Repository<Entity> {
    return this.activeDatabase.getRepository(entity);
  }

  // Entity getters that return the correct entity based on database type
  getUserEntity() {
    return this.databaseType === 'mongodb' ? UserEntityMongo : UserEntity;
  }

  getDocumentEntity() {
    return this.databaseType === 'mongodb' ? DocumentEntityMongo : DocumentEntity;
  }

  getDocumentChunkEntity() {
    return this.databaseType === 'mongodb' ? DocumentChunkEntityMongo : DocumentChunkEntity;
  }

  getDocumentChunkVectorEntity() {
    if (this.databaseType !== 'postgres') {
      throw new Error('Vector store is only supported with PostgreSQL');
    }
    return DocumentChunkVectorEntity;
  }

  getQueryHistoryEntity() {
    return this.databaseType === 'mongodb' ? QueryHistoryEntityMongo : QueryHistoryEntity;
  }

  getSessionEntity() {
    return this.databaseType === 'mongodb' ? SessionEntityMongo : SessionEntity;
  }

  getDocumentIngestionJobEntity() {
    if (this.databaseType !== 'postgres') {
      throw new Error('Document ingestion jobs are only available with PostgreSQL');
    }
    return DocumentIngestionJobEntity;
  }
}

export const dbAdapter = DatabaseAdapter.getInstance();
