import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Layout from "@/components/Layout";
import {
  UserGroupIcon,
  NoSymbolIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage customers, imports, and team operations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminTile
          href="/admin/customers"
          icon={UserGroupIcon}
          color="blue"
          title="All Customers"
          description="Searchable master view with filters by owner, type, and follow-up status"
        />
        <AdminTile
          href="/admin/closed-followups"
          icon={NoSymbolIcon}
          color="red"
          title="Closed Followups"
          description="Re-engage Not Interested / DNC / Service Taken customers"
        />
        <AdminTile
          href="/admin/imports"
          icon={ArrowDownTrayIcon}
          color="green"
          title="Imports"
          description="Upload registrations and bookings; auto-assigns unowned customers"
        />
        <AdminTile
          href="/admin/team"
          icon={UserGroupIcon}
          color="blue"
          title="Team"
          description="Manage agents: add, put on leave, reassign customers, and remove"
        />
      </div>
    </Layout>
  );
}

function AdminTile({
  href,
  icon: Icon,
  color,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "red" | "green";
  title: string;
  description: string;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
  };
  return (
    <Link
      href={href}
      className="bg-white p-6 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-sm transition"
    >
      <div className="flex items-start gap-3">
        <div className={"p-2 rounded-lg " + colors[color]}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  );
}