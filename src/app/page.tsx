import { auth, signOut } from "@/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">CRM Dashboard</h1>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Admin →
              </Link>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="text-sm text-gray-600 hover:text-gray-900">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <p className="text-gray-700">
          Welcome, <strong>{session?.user?.name}</strong> ({session?.user?.email})
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Role: <code className="bg-gray-100 px-2 py-1 rounded">{session?.user?.role}</code>
        </p>
      </div>
    </main>
  );
}