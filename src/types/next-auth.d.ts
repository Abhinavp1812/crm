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
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: "ADMIN" | "AGENT";
  }
}