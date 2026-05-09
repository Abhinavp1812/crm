import { auth } from "@/auth";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
}

export default async function Layout({ children }: LayoutProps) {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        userName={session.user.name || "User"}
        userRole={session.user.role}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 md:p-6 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}