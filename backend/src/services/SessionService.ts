import { SessionRepository } from '../database/repositories';
import { SessionEntity } from '../database/entities/postgresql';
import { v4 as uuidv4 } from 'uuid';

export class SessionService {
  private readonly sessionRepo: SessionRepository;

  constructor() {
    this.sessionRepo = new SessionRepository();
  }

  async createSession(userId: string, expiresInHours: number = 24): Promise<SessionEntity> {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    return this.sessionRepo.create({
      userId,
      token,
      expiresAt,
    });
  }

  async createSessionWithRefresh(
    userId: string,
    expiresInHours: number = 24
  ): Promise<SessionEntity> {
    const token = uuidv4();
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    return this.sessionRepo.create({
      userId,
      token,
      refreshToken,
      expiresAt,
    });
  }

  async getSessionByToken(token: string): Promise<SessionEntity | null> {
    const session = await this.sessionRepo.findByToken(token);
    
    if (!session) {
      return null;
    }

    // Check if expired
    if (session.expiresAt < new Date()) {
      await this.sessionRepo.delete(session.id);
      return null;
    }

    return session;
  }

  async validateToken(token: string): Promise<boolean> {
    const session = await this.getSessionByToken(token);
    return session !== null;
  }

  async refreshSession(token: string, newExpiresInHours: number = 24): Promise<SessionEntity> {
    const session = await this.getSessionByToken(token);
    
    if (!session) {
      throw new Error('Invalid or expired session');
    }

    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + newExpiresInHours);

    return this.sessionRepo.update(session.id, {
      expiresAt: newExpiresAt,
    });
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessionRepo.delete(id);
  }

  async deleteUserSessions(userId: string): Promise<number> {
    return this.sessionRepo.deleteByUserId(userId);
  }

  async cleanupExpiredSessions(): Promise<number> {
    return this.sessionRepo.deleteExpired();
  }

  async getUserSessions(userId: string): Promise<SessionEntity[]> {
    return this.sessionRepo.findByUserId(userId);
  }
}
