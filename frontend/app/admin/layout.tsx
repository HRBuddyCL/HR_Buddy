"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout } from "@/lib/api/admin-auth";
import { clearAuthToken } from "@/lib/auth/tokens";

const adminMenuItems = [
  {
    href: "/admin",
    label: "Dashboard",
    iconPath:
      "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6",
  },
  {
    href: "/admin/requests",
    label: "Requests",
    iconPath:
      "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    iconPath:
      "M11.049 2.927c.3-1.14 1.603-1.14 1.902 0l.24.912a1 1 0 00.95.69h.959c1.2 0 1.7 1.54.75 2.25l-.757.565a1 1 0 00-.364 1.118l.286.93c.35 1.136-.9 2.08-1.86 1.406l-.78-.55a1 1 0 00-1.151 0l-.78.55c-.96.674-2.21-.27-1.86-1.406l.286-.93a1 1 0 00-.364-1.118l-.757-.565c-.95-.71-.45-2.25.75-2.25h.959a1 1 0 00.95-.69l.24-.912z",
  },
  {
    href: "/admin/audit",
    label: "Audit Logs",
    iconPath:
      "M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z",
  },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname === "/admin/login") {
    return <div className="-mt-20">{children}</div>;
  }

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setMobileMenuOpen(false);
    setIsLoggingOut(true);

    try {
      await adminLogout();
    } catch {
      // ignore and clear local token anyway
    } finally {
      clearAuthToken("admin");
      router.replace("/admin/login");
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="-mt-20 min-h-screen bg-[radial-gradient(circle_at_top_right,_#f8fbff_0%,_#eef3fa_45%,_#e9eef7_100%)]">
      <div className="grid min-h-screen w-full items-stretch lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden min-h-screen flex-col border-r border-[#0e2d4c]/12 bg-white shadow-[0_22px_55px_-28px_rgba(14,45,76,0.34)] lg:flex">
          <div className="border-b border-[#0e2d4c]/10 bg-gradient-to-br from-[#f5f8ff] via-white to-[#fff8e3] px-5 py-6">
            <div className="rounded-2xl border border-[#0e2d4c]/10 bg-white p-3 shadow-sm">
              <Image
                src="/company-logo-sidebar.png"
                alt="Construction Lines"
                width={560}
                height={560}
                className="h-auto w-full rounded-xl object-contain"
                priority
              />
            </div>
            <p className="[font-family:var(--font-headline)] mt-4 text-[14px] font-bold uppercase tracking-[0.16em] text-[#0e2d4c]/60">
              Construction Lines
            </p>
            <h2 className="[font-family:var(--font-headline)] mt-1 text-2xl font-bold text-[#0e2d4c]">
              HR <span className="text-[#b62026]">Buddy</span>{" "}
              <span className="text-[#fed54f]">Admin</span>
            </h2>
          </div>

          <nav className="flex flex-1 flex-col p-4">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0e2d4c]/50">
              Admin Menu
            </p>

            <ul className="space-y-2">
              {adminMenuItems.map((item) => {
                const isActive = isActivePath(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-200 ${
                        isActive
                          ? "border-[#0e2d4c]/20 bg-[#0e2d4c] text-white shadow-[0_12px_28px_-14px_rgba(14,45,76,0.8)]"
                          : "border-transparent bg-slate-50 text-[#0e2d4c]/82 hover:border-[#0e2d4c]/15 hover:bg-white"
                      }`}
                    >
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                          isActive
                            ? "bg-white/16 text-white"
                            : "bg-[#0e2d4c]/8 text-[#0e2d4c]"
                        }`}
                      >
                        <svg
                          className="h-[18px] w-[18px]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={item.iconPath}
                          />
                        </svg>
                      </span>

                      <span className="block text-sm font-semibold">
                        {item.label}
                      </span>

                      {isActive ? (
                        <span className="pointer-events-none absolute inset-y-3 right-2 w-[3px] rounded-full bg-[#fed54f]" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="mt-auto space-y-2 pt-4">
              <Link
                href="/"
                className="group relative flex items-center gap-3 rounded-2xl border border-transparent bg-slate-50 px-3 py-3 text-[#0e2d4c]/82 transition-all duration-200 hover:border-[#0e2d4c]/15 hover:bg-white"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#0e2d4c]/8 text-[#0e2d4c]">
                  <svg
                    className="h-[18px] w-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"
                    />
                  </svg>
                </span>
                <span className="block text-sm font-semibold">Home</span>
              </Link>

              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="group relative flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[#fff1f2] px-3 py-3 text-left text-[#991b1b] transition-all duration-200 hover:border-[#fecdd3] hover:bg-[#ffe4e6] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fecdd3] text-[#b62026]">
                  <svg
                    className="h-[18px] w-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </span>
                <span className="block text-sm font-semibold">
                  {isLoggingOut ? "Logging out..." : "Log out"}
                </span>
              </button>
            </div>
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="relative sticky top-0 z-40 lg:hidden">
            <div className="h-[3px] w-full bg-gradient-to-r from-[#0e2d4c] via-[#b62026] to-[#fed54f]" />

            <div className="border-b border-[#0e2d4c]/10 bg-white/95 backdrop-blur-xl shadow-[0_6px_26px_-10px_rgba(14,45,76,0.14)]">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex h-[76px] items-center justify-between">
                  <Link href="/admin" className="group flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-[#0e2d4c] to-[#b62026] opacity-0 blur transition duration-300 group-hover:opacity-30" />
                      <div className="relative rounded-xl border border-[#0e2d4c]/12 bg-white p-2 shadow-sm">
                        <Image
                          src="/company-logo-navbar.jpg"
                          alt="Construction Lines"
                          width={44}
                          height={44}
                          className="h-11 w-11 rounded-lg object-contain"
                          priority
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="[font-family:var(--font-headline)] text-[14px] font-bold uppercase tracking-[0.16em] text-[#0e2d4c]/60 transition duration-300 group-hover:text-[#0e2d4c]/80">
                        Construction Lines
                      </span>
                      <span
                        className="[font-family:var(--font-headline)] text-[24px] font-bold leading-none tracking-tight text-[#0e2d4c] transition duration-300"
                        style={{ letterSpacing: "-0.02em" }}
                      >
                        HR{" "}
                        <span className="text-[#b62026] transition duration-300">
                          Buddy
                        </span>{" "}
                        <span className="text-[#fed54f] transition duration-300">
                          Admin
                        </span>
                      </span>
                    </div>
                  </Link>

                  <button
                    type="button"
                    aria-label="Toggle admin menu"
                    aria-expanded={mobileMenuOpen}
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#0e2d4c]/12 bg-white text-[#0e2d4c] shadow-sm transition-all duration-200 hover:border-[#b62026]/40 hover:text-[#b62026] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fed54f]"
                  >
                    <span
                      className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${
                        mobileMenuOpen ? "rotate-45" : "-translate-y-[6px]"
                      }`}
                    />
                    <span
                      className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${
                        mobileMenuOpen ? "scale-x-0 opacity-0" : ""
                      }`}
                    />
                    <span
                      className={`absolute h-[1.5px] w-[22px] bg-current transition-all duration-300 ${
                        mobileMenuOpen ? "-rotate-45" : "translate-y-[6px]"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`absolute inset-x-0 top-full origin-top transition-all duration-200 ease-out ${
                mobileMenuOpen
                  ? "pointer-events-auto scale-y-100 opacity-100"
                  : "pointer-events-none scale-y-95 opacity-0"
              }`}
            >
              <div className="border-b border-[#0e2d4c]/10 bg-white/98 px-4 pb-6 pt-3 shadow-xl backdrop-blur-xl">
                <div className="space-y-1 rounded-2xl border border-[#0e2d4c]/8 bg-[#f8f9fc] p-2">
                  {adminMenuItems.map((item) => {
                    const isActive = isActivePath(pathname, item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                          isActive
                            ? "bg-[#0e2d4c] text-white shadow-sm"
                            : "text-[#0e2d4c]/70 hover:bg-white hover:text-[#0e2d4c] hover:shadow-sm"
                        }`}
                      >
                        <span
                          className={`h-5 w-[3px] rounded-full ${isActive ? "bg-[#fed54f]" : "bg-transparent"}`}
                        />
                        <svg
                          className="h-[17px] w-[17px] shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={item.iconPath}
                          />
                        </svg>
                        {item.label}
                      </Link>
                    );
                  })}

                  <div className="mx-2 my-2 h-px bg-[#0e2d4c]/8" />

                  <Link
                    href="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-[#0e2d4c]/70 transition-all duration-200 hover:bg-white hover:text-[#0e2d4c] hover:shadow-sm"
                  >
                    <span className="h-5 w-[3px] rounded-full bg-transparent" />
                    <svg
                      className="h-[17px] w-[17px] shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"
                      />
                    </svg>
                    Home
                  </Link>

                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={isLoggingOut}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#b62026] px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-[#b62026]/20 transition-all duration-300 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <svg
                      className="h-5 w-5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 py-4 md:px-6 lg:px-8 lg:py-8 [&>main]:mx-0 [&>main]:max-w-none [&>main]:min-h-0 [&>main]:px-0 [&>main]:py-0">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}


