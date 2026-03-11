"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/",
    label: "หน้าหลัก",
    iconPath:
      "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6",
  },
  {
    href: "/my-requests",
    label: "คำขอของฉัน",
    iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z",
  },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const pathname = usePathname();
  const isMobileMenuOpen = mobileMenuPath === pathname;

  const toggleMobileMenu = () => {
    setMobileMenuPath((prev) => (prev === pathname ? null : pathname));
  };

  const closeMobileMenu = () => {
    setMobileMenuPath(null);
  };

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#0e2d4c]/15 bg-white/92 shadow-[0_12px_30px_-24px_rgba(14,45,76,0.9)] backdrop-blur-xl">
      <div className="h-1 w-full bg-gradient-to-r from-[#0e2d4c] via-[#b62026] to-[#fed54f]" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center">
            <Link href="/" className="group flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 transition">
              <div className="rounded-xl border border-[#0e2d4c]/20 bg-white p-1 shadow-sm transition group-hover:border-[#b62026]/40">
                <Image
                  src="/company-logo.jpg"
                  alt="Construction Lines Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-lg bg-white object-contain"
                />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="block truncate text-lg font-bold tracking-tight text-[#0e2d4c] sm:text-xl">Construction Lines</span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b62026] sm:text-xs">HR Buddy</span>
              </div>
            </Link>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => {
              const isActive = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f] focus-visible:ring-offset-2 ${
                    isActive
                      ? "bg-[#0e2d4c] text-white shadow-sm"
                      : "text-[#0e2d4c] hover:bg-[#fed54f]/25 hover:text-[#0e2d4c]"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <Link
              href="/admin/login"
              className="ml-2 inline-flex items-center gap-2 rounded-full bg-[#b62026] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0e2d4c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f] focus-visible:ring-offset-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              <span>เข้าสู่ระบบแอดมิน</span>
            </Link>
          </div>

          <div className="md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center rounded-xl border border-[#0e2d4c]/20 bg-white p-2.5 text-[#0e2d4c] transition hover:border-[#b62026]/45 hover:text-[#b62026] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f] focus-visible:ring-offset-2"
              aria-label="Toggle mobile menu"
              aria-expanded={isMobileMenuOpen}
            >
              <div className="relative h-5 w-5">
                <span
                  className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "translate-y-[9px] rotate-45" : ""}`}
                />
                <span
                  className={`absolute left-0 top-[9px] h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "opacity-0" : ""}`}
                />
                <span
                  className={`absolute left-0 top-[18px] h-0.5 w-5 bg-current transition ${isMobileMenuOpen ? "-translate-y-[9px] -rotate-45" : ""}`}
                />
              </div>
            </button>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 md:hidden ${
            isMobileMenuOpen ? "max-h-96 pb-4 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="space-y-2 rounded-2xl border border-[#0e2d4c]/15 bg-white p-3 shadow-[0_15px_24px_-20px_rgba(14,45,76,0.8)]">
            {navItems.map((item) => {
              const isActive = isActivePath(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#0e2d4c] text-white"
                      : "text-[#0e2d4c] hover:bg-[#fed54f]/25 hover:text-[#0e2d4c]"
                  }`}
                  onClick={closeMobileMenu}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
                  </svg>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <Link
              href="/admin/login"
              className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#b62026] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0e2d4c]"
              onClick={closeMobileMenu}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              <span>เข้าสู่ระบบแอดมิน</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
