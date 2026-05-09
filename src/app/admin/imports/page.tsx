import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Layout from "@/components/Layout";
import { ArrowDownTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

export default async function ImportsHub() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Imports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload data files. Auto-assigns unassigned customers via round-robin.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/import/registrations"
          className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <ArrowDownTrayIcon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Import Registrations</h2>
              <p className="text-sm text-gray-600 mt-1">
                Upload registrations CSV or XLSX. New customers without an owner are auto-assigned to active agents.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/import/bookings"
          className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <DocumentTextIcon className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Import Bookings</h2>
              <p className="text-sm text-gray-600 mt-1">
                Upload bookings CSV or XLSX. Latest booking wins; auto-creates followups +20 days from booking date.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </Layout>
  );
}