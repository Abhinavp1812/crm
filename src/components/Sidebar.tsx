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
} from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";
import SelfLeaveButton from "./SelfLeaveButton";

interface SidebarProps {
  userName: string;
  userRole: "ADMIN" | "AGENT";
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export default function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Agent and admin both see followups + customers; admin doesn't get "My Stats"
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
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition " +
          (active
            ? "bg-blue-50 text-blue-700 font-medium border-l-2 border-blue-600"
            : "text-gray-700 hover:bg-gray-100")
        }
        title={collapsed ? item.label : undefined}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-white rounded-md shadow"
        aria-label="Open menu"
      >
        {mobileOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/30 z-30"
        />
      )}

      <aside
        className={
          "bg-white border-r border-gray-200 flex flex-col transition-all duration-200 z-40 " +
          (collapsed ? "w-16" : "w-56") +
          " " +
          (mobileOpen ? "fixed inset-y-0 left-0 md:relative" : "hidden md:flex")
        }
      >
        <div className="h-14 flex items-center px-4 border-b border-gray-200">
          {!collapsed ? (
            <span className="font-bold text-lg text-gray-900">Style Lounge</span>
          ) : (
            <span className="font-bold text-lg text-gray-900 mx-auto">SL</span>
          )}
        </div>

        {!collapsed && (
          <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-500">{userRole}</p>
              {userRole === "AGENT" && (
                <div className="mt-2">
                  <SelfLeaveButton role={userRole} />
                </div>
              )}
            </div>
        )}

        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {userNav.map(renderNavItem)}

          {userRole === "ADMIN" && (
            <>
              <div className={"mt-4 mb-2 px-3 " + (collapsed ? "hidden" : "")}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Admin</p>
              </div>
              {adminNav.map(renderNavItem)}
            </>
          )}
        </nav>

        <div className="border-t border-gray-200 p-2 space-y-1">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition"
            title={collapsed ? "Sign out" : undefined}
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 transition"
            title={collapsed ? "Expand" : "Collapse"}
          >
            <Bars3Icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}