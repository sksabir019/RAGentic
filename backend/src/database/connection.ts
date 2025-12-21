import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  UserEntity,
  DocumentEntity,
  DocumentChunkEntity,
  DocumentChunkVectorEntity,
  DocumentIngestionJobEntity,
  QueryHistoryEntity,
  SessionEntity,
} from './entities/postgresql';

const isDevelopment = process.env.NODE_ENV === 'development';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number.parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'ragentic_dev',
  entities: [
    UserEntity,
    DocumentEntity,
    DocumentChunkEntity,
    DocumentChunkVectorEntity,
    DocumentIngestionJobEntity,
    QueryHistoryEntity,
    SessionEntity,
  ],
  synchronize: false,
  logging: isDevelopment,
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

export async function setupDatabase(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('PostgreSQL database connected successfully');
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    console.log('Database connection closed');
  }
}

// Export unified setup function that uses adapter
export async function setupDatabaseAdapter(): Promise<void> {
  const { dbAdapter } = await import('./adapter');
  try {
    await dbAdapter.initialize();
    console.log(`Database initialized using ${dbAdapter.getDatabaseType()}`);
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

export async function closeDatabaseAdapter(): Promise<void> {
  const { dbAdapter } = await import('./adapter');
  try {
    await dbAdapter.close();
  } catch (error) {
    console.error('Database close failed:', error);
    throw error;
  }
}
