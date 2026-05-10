"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  HomeIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  NoSymbolIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { signOut, useSession } from "next-auth/react";
import SelfLeaveButton from "./SelfLeaveButton";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function Sidebar() {
  const { data: session } = useSession();
  const userName = session?.user?.name || "User";
  const userRole = session?.user?.role;
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userNav: NavItem[] = [
    { label: "Followups", href: "/", icon: HomeIcon },
    { label: "Customers", href: "/customers", icon: UserGroupIcon },
  ];
  if (userRole === "AGENT") {
    userNav.push({ label: "My Stats", href: "/stats", icon: ChartBarIcon });
  }

  const adminNav: NavItem[] = [
    { label: "Admin", href: "/admin", icon: Cog6ToothIcon },
    { label: "Imports", href: "/admin/imports", icon: ArrowDownTrayIcon },
    { label: "Closed", href: "/admin/closed-followups", icon: NoSymbolIcon },
    { label: "Team Stats", href: "/admin/stats", icon: ChartBarIcon },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors " +
          (active
            ? "bg-blue-600 text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")
        }
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  const avatar = userName.charAt(0).toUpperCase();

  const sidebarContent = (
    <aside
      className={
        "bg-white border-r border-gray-200 flex flex-col z-40 transition-all duration-200 " +
        "sticky top-0 h-screen " +
        (collapsed ? "w-16" : "w-60")
      }
    >
      {/* Logo + collapse toggle */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-gray-100 flex-shrink-0">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">SL</span>
              </div>
              <span className="font-semibold text-gray-900 text-sm tracking-tight">Style Lounge</span>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Collapse"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Expand"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* User info */}
      <div className={"border-b border-gray-100 flex-shrink-0 " + (collapsed ? "py-3 flex justify-center" : "px-3 py-3")}>
        {collapsed ? (
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold"
            title={userName}
          >
            {avatar}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {avatar}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{userRole}</p>
              </div>
            </div>
            {userRole === "AGENT" && (
              <div className="mt-2.5 pl-[42px]">
                <SelfLeaveButton role={userRole} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Navigation — scrollable */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {userNav.map(renderNavItem)}

        {userRole === "ADMIN" && (
          <>
            {collapsed
              ? <div className="my-3 border-t border-gray-100" />
              : (
                <div className="pt-5 pb-1.5 px-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Admin</p>
                </div>
              )
            }
            {adminNav.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Sign out — always visible, never pushed off screen */}
      <div className="border-t border-gray-100 p-2 flex-shrink-0">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          title={collapsed ? "Sign out" : undefined}
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
        aria-label="Open menu"
      >
        {mobileOpen ? <XMarkIcon className="h-5 w-5 text-gray-600" /> : <Bars3Icon className="h-5 w-5 text-gray-600" />}
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/40 z-30"
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        {sidebarContent}
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-y-0 left-0 z-40 w-60 shadow-xl">
          {sidebarContent}
        </div>
      )}
    </>
  );
}
