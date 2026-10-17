import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import type { UserRole } from '@bom/shared';
import { PrismaService } from '../prisma/prisma.service';

// OWASP-recommended argon2id parameters (19 MiB, 2 iterations).
const ARGON2 = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  hashPassword(password: string): Promise<string> {
    return hash(password, ARGON2);
  }

  verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true, role: true, isActive: true, passwordHash: true },
    });
  }

  async create(input: { email: string; name: string; password: string; role: UserRole }) {
    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        role: input.role,
        passwordHash: await this.hashPassword(input.password),
      },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  /** Sets a new password and signs the user out everywhere. */
  async setPassword(userId: string, password: string): Promise<void> {
    const passwordHash = await this.hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);
  }
}
