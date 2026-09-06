import type { DefaultSession } from 'next-auth';
import type { Role, VerificationStatus } from '@/lib/models/User';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      verificationStatus: VerificationStatus;
    } & DefaultSession['user'];
  }

  interface User {
    role?: Role;
    verificationStatus?: VerificationStatus;
  }
}

// Augment the original module — `next-auth/jwt` only re-exports
// (`export * from "@auth/core/jwt"`), and TS augmentation does not follow
// wildcard re-exports.
declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    role?: Role;
    verificationStatus?: VerificationStatus;
  }
}
