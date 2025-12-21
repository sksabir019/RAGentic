import bcryptjs from 'bcryptjs';
import { UserRepository } from '../database/repositories';
import { UserEntity } from '../database/entities/postgresql';
import { dbAdapter } from '../database/adapter';

export class UserService {
  private readonly userRepo: UserRepository;
  private readonly isMongoDb: boolean;

  constructor() {
    this.userRepo = new UserRepository();
    this.isMongoDb = dbAdapter.getDatabaseType() === 'mongodb';
  }

  async getUserById(id: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findById(id);
    return this.mapUser(user);
  }

  async getUserByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.userRepo.findByEmail(email);
    return this.mapUser(user);
  }

  private mapUser(user: any): UserEntity | null {
    if (!user) return null;
    
    // Map MongoDB fields to PostgreSQL entity structure
    if (this.isMongoDb) {
      return {
        id: user._id?.toString() || user.id,
        email: user.email,
        password: user.passwordHash || user.password,
        firstName: user.firstName || (user.name ? user.name.split(' ')[0] : ''),
        lastName: user.lastName || (user.name ? user.name.split(' ').slice(1).join(' ') : ''),
        role: user.role || 'user',
        verified: user.verified || false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } as UserEntity;
    }
    
    return user as UserEntity;
  }

  async createUser(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ): Promise<UserEntity> {
    // Check if user exists
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    const userData: any = this.isMongoDb
      ? {
          email,
          passwordHash: hashedPassword,
          name: [firstName || '', lastName || ''].filter(Boolean).join(' ') || 'User',
          role: 'user',
          verified: false,
        }
      : {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'user',
          verified: false,
        };

    const user = await this.userRepo.create(userData);
    const mapped = this.mapUser(user);
    if (!mapped) {
      throw new Error('Failed to create user');
    }
    return mapped;
  }

  async updateUser(id: string, userData: Partial<UserEntity>): Promise<UserEntity> {
    // Don't allow direct password updates via this method
    const { password, ...safeData } = userData;
    const updated = await this.userRepo.update(id, safeData as any);
    return this.mapUser(updated) || updated;
  }

  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Get the actual password field depending on database type
    const userPasswordHash = this.isMongoDb 
      ? (user as any).passwordHash 
      : (user as any).password;

    // Verify old password
    const isValid = await bcryptjs.compare(oldPassword, userPasswordHash);
    if (!isValid) {
      throw new Error('Old password is incorrect');
    }

    // Hash and update new password
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    const updateData = this.isMongoDb
      ? { passwordHash: hashedPassword }
      : { password: hashedPassword };
    
    await this.userRepo.update(id, updateData as any);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(password, hash);
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.userRepo.delete(id);
  }

  async listUsers(skip: number = 0, take: number = 10): Promise<UserEntity[]> {
    return this.userRepo.findAll(skip, take);
  }

  async getUserCount(): Promise<number> {
    return this.userRepo.count();
  }
}
