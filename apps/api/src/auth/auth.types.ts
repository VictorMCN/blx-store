import type { UserRole } from '../generated/prisma/enums.js';

export interface AuthenticatedUser {
  id: string;
  fullName: string | null;
  email: string;
  role: UserRole;
  createdAt: Date;
}
