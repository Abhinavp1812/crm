import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Layout from "@/components/Layout";
import LeadSourceManager from "@/components/LeadSourceManager";

export default async function LeadSourcesPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lead Sources</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage the campaigns/channels agents can tag a customer with (e.g. &quot;Pedicure Campaign&quot;, &quot;Dyson Campaign&quot;).
        </p>
      </div>
      <LeadSourceManager />
    </Layout>
  );
}
