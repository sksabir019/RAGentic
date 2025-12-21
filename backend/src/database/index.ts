// PostgreSQL exports
export { AppDataSource, setupDatabase, closeDatabase, setupDatabaseAdapter, closeDatabaseAdapter } from './connection';
export { 
  UserEntity, 
  DocumentEntity, 
  DocumentChunkEntity, 
  QueryHistoryEntity, 
  SessionEntity 
} from './entities/postgresql';

// MongoDB exports
export { 
  MongoDataSource, 
  setupMongoDatabase, 
  closeMongoDatabase 
} from './mongo-connection';
export { 
  UserEntityMongo, 
  DocumentEntityMongo, 
  DocumentChunkEntityMongo, 
  QueryHistoryEntityMongo, 
  SessionEntityMongo 
} from './entities/mongodb';

// Adapter exports
export { DatabaseAdapter, dbAdapter, type DatabaseType } from './adapter';

// Repository exports
export * from './repositories';
