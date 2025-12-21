/**
 * Database adapter interface for supporting multiple database types
 */

export type DatabaseType = 'mongodb' | 'postgresql';

export interface IUserModel {
  id: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'user';
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentModel {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key?: string;
  metadata: Record<string, any>;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDocumentChunkModel {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  embedding?: number[];
  pageNumber?: number;
  chunkIndex: number;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface IQueryHistoryModel {
  id: string;
  userId: string;
  query: string;
  documentIds: string[];
  response: string;
  citations: Array<{ documentId: string; text: string; pageNumber?: number }>;
  confidence: number;
  executionTimeMs: number;
  createdAt: Date;
}

export interface ISessionModel {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  
  // User operations
  createUser(data: IUserModel): Promise<IUserModel>;
  getUserById(id: string): Promise<IUserModel | null>;
  getUserByEmail(email: string): Promise<IUserModel | null>;
  updateUser(id: string, data: Partial<IUserModel>): Promise<IUserModel>;
  deleteUser(id: string): Promise<void>;
  
  // Document operations
  createDocument(data: IDocumentModel): Promise<IDocumentModel>;
  getDocumentById(id: string): Promise<IDocumentModel | null>;
  getDocumentsByUserId(userId: string): Promise<IDocumentModel[]>;
  updateDocument(id: string, data: Partial<IDocumentModel>): Promise<IDocumentModel>;
  deleteDocument(id: string): Promise<void>;
  
  // Document chunk operations
  createChunk(data: IDocumentChunkModel): Promise<IDocumentChunkModel>;
  getChunksByDocumentId(documentId: string): Promise<IDocumentChunkModel[]>;
  getChunksByUserId(userId: string): Promise<IDocumentChunkModel[]>;
  updateChunk(id: string, data: Partial<IDocumentChunkModel>): Promise<IDocumentChunkModel>;
  deleteChunksByDocumentId(documentId: string): Promise<void>;
  
  // Query history operations
  createQueryHistory(data: IQueryHistoryModel): Promise<IQueryHistoryModel>;
  getQueryHistoryByUserId(userId: string, limit?: number): Promise<IQueryHistoryModel[]>;
  getQueryHistoryById(id: string): Promise<IQueryHistoryModel | null>;
  
  // Session operations
  createSession(data: ISessionModel): Promise<ISessionModel>;
  getSessionByToken(token: string): Promise<ISessionModel | null>;
  getSessionById(id: string): Promise<ISessionModel | null>;
  updateSession(id: string, data: Partial<ISessionModel>): Promise<ISessionModel>;
  deleteSession(id: string): Promise<void>;
  deleteExpiredSessions(): Promise<number>;
}
