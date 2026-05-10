import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: "ADMIN" | "AGENT";
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "ADMIN" | "AGENT";
      photoUpdatedAt?: number; // Unix ms — used as cache-bust param for /api/profile/photo
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: "ADMIN" | "AGENT";
    photoUpdatedAt?: number;
  }
}
