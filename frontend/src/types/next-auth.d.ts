import "next-auth";
import "next-auth/jwt";

type Role = "ADMIN" | "USER";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "TokenExpired";
    /** Hay un código por correo pendiente de verificar (inicio con Google). */
    mfaChallengeId?: string;
    mfaSentTo?: string;
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: Role;
    };
  }

  interface User {
    role: Role;
    accessToken: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    accessTokenExpires?: number;
    role?: Role;
    error?: "TokenExpired";
    mfaChallengeId?: string;
    mfaSentTo?: string;
  }
}
