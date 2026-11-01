import { Outlet, Link } from "react-router-dom";
import Logo from "@/components/layout/Logo.jsx";

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#05070a] text-[#dfe7e0]">
      <a
        href="#main-content"
        className="sr-only z-[100] bg-white px-4 py-3 text-sm font-bold text-black focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-white/[.08] bg-[#05070a]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-7">
          <Logo onDark />
          <nav aria-label="Public navigation" className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-[#8b958f] transition hover:text-[#dfe7e0] sm:inline-flex"
            >
              Explore
            </Link>
            <Link
              to="/login"
              className="rounded-sm border border-white/[.15] px-3.5 py-1.5 text-sm font-semibold text-[#dfe7e0] transition hover:border-white hover:bg-white/[.06]"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-sm bg-[#e0231c] px-4 py-1.5 text-sm font-bold text-white shadow-md shadow-red-950/40 transition hover:bg-[#bf1d17]"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div id="main-content">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-white/[.08] bg-[#05070a] px-5 py-6 text-xs text-[#78837c]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {new Date().getFullYear()} CampusLink</span>
          <span>Placement and recruitment for universities</span>
        </div>
      </footer>
    </div>
  );
}
