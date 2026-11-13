import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

// URL de la API vista desde el servidor de Next.js (en Docker puede ser distinta a la del navegador)
const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface ApiAuthResponse {
  user: { id: string; email: string; name: string; role: "ADMIN" | "USER" };
  accessToken: string;
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
    // Inicio de sesión local: la API compara la contraseña contra el hash bcrypt
    CredentialsProvider({
      name: "Correo y contraseña",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "No se pudo iniciar sesión");
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
      // Inicio de sesión con Google: se canjea el id_token de Google por un JWT propio de la API
      if (account?.provider === "google" && account.id_token) {
        const res = await fetch(`${API_URL}/api/auth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: account.id_token }),
        });
        if (!res.ok) {
          throw new Error("La API rechazó el inicio de sesión con Google");
        }
        const data = (await res.json()) as ApiAuthResponse;
        token.accessToken = data.accessToken;
        token.role = data.user.role;
        token.accessTokenExpires = tokenExpiry(data.accessToken);
      }

      // Inicio de sesión local (Credentials)
      if (account?.provider === "credentials" && user) {
        token.accessToken = user.accessToken;
        token.role = user.role;
        token.accessTokenExpires = tokenExpiry(user.accessToken);
      }

      if (token.accessTokenExpires && Date.now() > token.accessTokenExpires) {
        token.error = "TokenExpired";
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      if (session.user) {
        session.user.email = token.email;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
