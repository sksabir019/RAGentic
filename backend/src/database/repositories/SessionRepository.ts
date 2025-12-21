import { Repository } from 'typeorm';
import { dbAdapter } from '../adapter';
import { SessionEntity } from '../entities/postgresql';

export class SessionRepository {
  private readonly repo: Repository<SessionEntity>;

  constructor() {
    this.repo = dbAdapter.getRepository(dbAdapter.getSessionEntity());
  }

  async findById(id: string): Promise<SessionEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async findByToken(token: string): Promise<SessionEntity | null> {
    return this.repo.findOneBy({ token });
  }

  async findByUserId(userId: string): Promise<SessionEntity[]> {
    return this.repo.findBy({ userId });
  }

  async create(sessionData: Partial<SessionEntity>): Promise<SessionEntity> {
    const session = this.repo.create(sessionData);
    return this.repo.save(session);
  }

  async update(
    id: string,
    sessionData: Partial<SessionEntity>
  ): Promise<SessionEntity> {
    await this.repo.update(id, sessionData);
    const updated = await this.repo.findOneBy({ id });
    if (!updated) {
      throw new Error('Session not found after update');
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .where('expiresAt < NOW()')
      .execute();
    return result.affected ?? 0;
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.repo.delete({ userId });
    return result.affected ?? 0;
  }

  async isTokenValid(token: string): Promise<boolean> {
    const session = await this.repo.findOne({
      where: { token },
      select: ['expiresAt'],
    });

    if (!session) {
      return false;
    }

    return session.expiresAt > new Date();
  }
}
