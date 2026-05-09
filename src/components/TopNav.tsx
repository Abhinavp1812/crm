import { auth, signOut } from "@/auth";
import Link from "next/link";
import SearchBar from "./SearchBar";
import SelfLeaveButton from "./SelfLeaveButton";
import { prisma } from "@/lib/prisma";

export default async function TopNav() {
  const session = await auth();

  // Sometimes the session token may not include role (older sessions). If role is missing,
  // backfill from the database so the UI (self-serve button) can render correctly.
  let role = session?.user?.role;
  if (!role && session?.user?.id) {
    try {
      const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
      if (dbUser?.role === "ADMIN" || dbUser?.role === "AGENT") role = dbUser.role;
    } catch {
      // ignore DB errors and fall back to whatever we have
    }
  }

  const isAdmin = role === "ADMIN";

  return (
    <nav className="bg-white border-b shadow-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg text-gray-900">
            CRM
          </Link>
          <Link href="/" className="text-sm text-gray-700 hover:text-gray-900">
            Today's Followups
          </Link>
          {isAdmin ? (
            <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Admin
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <SearchBar />
          <span className="text-sm text-gray-600 whitespace-nowrap">
            {session?.user?.name}{" "}
            <span className="text-gray-400">({session?.user?.role})</span>
          </span>
          {/* Agent self-service leave button */}
          <SelfLeaveButton name={session?.user?.name} role={session?.user?.role} />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-sm text-gray-600 hover:text-gray-900">Sign out</button>
          </form>
        </div>
      </div>
    </nav>
  );
}