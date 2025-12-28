import 'reflect-metadata';
import { DataSource } from 'typeorm';
import {
  UserEntityMongo,
  DocumentEntityMongo,
  DocumentChunkEntityMongo,
  QueryHistoryEntityMongo,
  SessionEntityMongo,
} from './entities/mongodb';

const isDevelopment = process.env.NODE_ENV === 'development';

// Build MongoDB URI from environment variables
const mongoHost = process.env.MONGODB_HOST || 'localhost';
const mongoPort = process.env.MONGODB_PORT || '27017';
const mongoUser = process.env.MONGODB_USER || 'root';
const mongoPassword = process.env.MONGODB_PASSWORD || 'root123';
const mongoDatabase = process.env.MONGODB_DATABASE || 'ragentic';

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 
  `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}/${mongoDatabase}?authSource=admin`;

export const MongoDataSource = new DataSource({
  type: 'mongodb',
  url: mongoUri,
  entities: [
    UserEntityMongo,
    DocumentEntityMongo,
    DocumentChunkEntityMongo,
    QueryHistoryEntityMongo,
    SessionEntityMongo,
  ],
  synchronize: isDevelopment,
  logging: isDevelopment,
});

export async function setupMongoDatabase(): Promise<void> {
  try {
    if (!MongoDataSource.isInitialized) {
      await MongoDataSource.initialize();
      console.log('MongoDB database connected successfully');
    }
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    throw error;
  }
}

export async function closeMongoDatabase(): Promise<void> {
  if (MongoDataSource.isInitialized) {
    await MongoDataSource.destroy();
    console.log('MongoDB connection closed');
  }
}
