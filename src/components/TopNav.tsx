import { auth, signOut } from "@/auth";
import Link from "next/link";

export default async function TopNav() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-lg">
            CRM
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            Today's Followups
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Admin
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {session?.user?.name} <span className="text-gray-400">({session?.user?.role})</span>
          </span>
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