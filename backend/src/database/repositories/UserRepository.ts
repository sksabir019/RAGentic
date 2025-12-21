import { Repository } from 'typeorm';
import { dbAdapter } from '../adapter';
import { UserEntity } from '../entities/postgresql';

export class UserRepository {
  private readonly repo: Repository<UserEntity>;

  constructor() {
    this.repo = dbAdapter.getRepository(dbAdapter.getUserEntity());
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOneBy({ email });
  }

  async create(userData: Partial<UserEntity>): Promise<UserEntity> {
    const user = this.repo.create(userData);
    return this.repo.save(user);
  }

  async update(id: string, userData: Partial<UserEntity>): Promise<UserEntity> {
    await this.repo.update(id, userData);
    const updated = await this.repo.findOneBy({ id });
    if (!updated) {
      throw new Error('User not found after update');
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async findAll(skip: number = 0, take: number = 10): Promise<UserEntity[]> {
    return this.repo.find({ skip, take });
  }

  async count(): Promise<number> {
    return this.repo.count();
  }
}
