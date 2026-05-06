import { auth, signOut } from "@/auth";

export default async function HomePage() {
  const session = await auth();
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">CRM Dashboard</h1>
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
        <p className="text-gray-700">
          Welcome, <strong>{session?.user?.name}</strong> ({session?.user?.email})
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Day 1 setup complete. Customers, follow-ups, and team management coming next.
        </p>
      </div>
    </main>
  );
}