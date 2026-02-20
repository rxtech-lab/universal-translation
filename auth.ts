import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

// Deduplication lock: ensures only one refresh request runs at a time
let refreshPromise: Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> | null = null;

async function refreshAccessToken(refreshToken: string) {
  console.log("Refreshing access token...");
  const response = await fetch(`${process.env.AUTH_ISSUER}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.AUTH_CLIENT_ID!,
      client_secret: process.env.AUTH_CLIENT_SECRET!,
    }),
  });

  const tokens = await response.json();
  if (!response.ok) throw tokens;

  return {
    accessToken: tokens.access_token as string,
    refreshToken: (tokens.refresh_token ?? refreshToken) as string,
    expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.NODE_ENV === "development",
  providers: [
    {
      id: "rxlab",
      name: "RxLab",
      type: "oidc",
      issuer: process.env.AUTH_ISSUER,
      clientId: process.env.AUTH_CLIENT_ID!,
      clientSecret: process.env.AUTH_CLIENT_SECRET!,
      client: {
        token_endpoint_auth_method: "client_secret_post",
      },
      authorization: {
        params: {
          scope: "openid email profile offline_access",
        },
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial login - store all tokens and real user ID from OIDC provider
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          // Store the real user ID from OIDC provider (not NextAuth's internal sub)
          userId: profile?.sub,
        };
      }

      // Token still valid - return as is
      if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000) {
        return token;
      }

      // Token expired - attempt refresh
      if (!token.refreshToken) {
        console.error("No refresh token available", token);
        return { ...token, error: "RefreshTokenError" };
      }

      try {
        // Deduplicate concurrent refresh requests — only one HTTP call at a time
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken(
            token.refreshToken as string,
          ).finally(() => {
            refreshPromise = null;
          });
        }
        const freshTokens = await refreshPromise;

        return {
          ...token,
          accessToken: freshTokens.accessToken,
          refreshToken: freshTokens.refreshToken,
          expiresAt: freshTokens.expiresAt,
          error: undefined,
        };
      } catch (error) {
        console.error("Token refresh failed:", error);
        return { ...token, error: "RefreshTokenError" };
      }
    },
    async session({ session, token }) {
      // Populate user data from token
      // Use userId (real OIDC sub) instead of token.sub (NextAuth's internal ID)
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      if (token.name) {
        session.user.name = token.name as string;
      }
      if (token.email) {
        session.user.email = token.email as string;
      }
      if (token.picture) {
        session.user.image = token.picture as string;
      }

      // Make access token available to the client
      session.accessToken = token.accessToken as string | undefined;
      session.error = token.error as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
