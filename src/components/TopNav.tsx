import { auth, signOut } from "@/auth";
import Link from "next/link";
import SearchBar from "./SearchBar";

export default async function TopNav() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

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