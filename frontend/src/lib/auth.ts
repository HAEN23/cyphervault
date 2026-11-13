import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

// URL de la API vista desde el servidor de Next.js (en Docker puede ser distinta a la del navegador)
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiAuthResponse {
  user: { id: string; email: string; name: string; role: "ADMIN" | "USER" };
  accessToken: string;
}

interface ApiMfaChallenge {
  mfaRequired: true;
  challengeId: string;
  sentTo: string;
}

/** Lee la fecha de expiración (exp) del JWT de la API, sin verificarlo (eso lo hace la API). */
function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return payload.exp * 1000;
  } catch {
    return 0;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    // Paso 2 de TODOS los inicios de sesión: el código de 6 dígitos que llegó por correo.
    // (El paso 1, contraseña o Google, ya devolvió un challengeId.)
    CredentialsProvider({
      id: "mfa",
      name: "Código de verificación",
      credentials: {
        challengeId: { label: "Reto", type: "text" },
        code: { label: "Código", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.challengeId || !credentials?.code) return null;
        const res = await fetch(`${API_URL}/api/auth/mfa/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId: credentials.challengeId, code: credentials.code }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Código incorrecto");
        }
        const data = (await res.json()) as ApiAuthResponse;
        return { ...data.user, accessToken: data.accessToken };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hora, igual que el JWT de la API
  },
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Paso 1 con Google: la API verifica el id_token y manda el código por correo.
      // Todavía NO hay accessToken: la sesión queda "pendiente de verificación".
      if (account?.provider === "google" && account.id_token) {
        const res = await fetch(`${API_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: account.id_token }),
        });
        if (!res.ok) {
          throw new Error("La API rechazó el inicio de sesión con Google");
        }
        const data = (await res.json()) as ApiMfaChallenge;
        token.mfaChallengeId = data.challengeId;
        token.mfaSentTo = data.sentTo;
        delete token.accessToken;
        delete token.role;
      }

      // Paso 2 superado: ahora sí se guarda el JWT de la API
      if (account?.provider === "mfa" && user) {
        token.accessToken = user.accessToken;
        token.role = user.role;
        token.accessTokenExpires = tokenExpiry(user.accessToken);
        delete token.mfaChallengeId;
        delete token.mfaSentTo;
      }

      if (token.accessTokenExpires && Date.now() > token.accessTokenExpires) {
        token.error = "TokenExpired";
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.mfaChallengeId = token.mfaChallengeId;
      session.mfaSentTo = token.mfaSentTo;
      if (session.user) {
        session.user.email = token.email;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
