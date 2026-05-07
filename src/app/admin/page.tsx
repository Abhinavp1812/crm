import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/TopNav";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Admin</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/admin/import/registrations"
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
            >
              <h2 className="font-semibold text-lg">📥 Import Registrations</h2>
              <p className="text-sm text-gray-600 mt-1">
                Upload registrations CSV or XLSX
              </p>
            </Link>
            <Link
              href="/admin/import/bookings"
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition"
            >
              <h2 className="font-semibold text-lg">📥 Import Bookings</h2>
              <p className="text-sm text-gray-600 mt-1">
                Upload bookings CSV or XLSX
              </p>
            </Link>
            <Link
              href="/admin/imports"
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition opacity-50"
            >
              <h2 className="font-semibold text-lg">📜 Import History</h2>
              <p className="text-sm text-gray-600 mt-1">Coming in Day 3</p>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}