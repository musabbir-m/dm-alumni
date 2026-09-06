import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString();
        if (!email || !password) return null;

        await connectDB();
        const user = await User.findOne({ email });
        if (!user) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        // Only the identity needed for the JWT — the profile page re-reads the
        // full record from the database.
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          verificationStatus: user.verificationStatus,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.verificationStatus = user.verificationStatus;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? '';
        session.user.role = token.role ?? 'alumni';
        session.user.verificationStatus = token.verificationStatus ?? 'pending';
      }
      return session;
    },
  },
});
