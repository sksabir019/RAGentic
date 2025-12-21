import 'reflect-metadata';
import dotenv from 'dotenv';
import { AppDataSource } from './connection';

dotenv.config();

async function runMigrations(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    await AppDataSource.runMigrations();
    console.log('Database migrations executed successfully.');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
runMigrations();
