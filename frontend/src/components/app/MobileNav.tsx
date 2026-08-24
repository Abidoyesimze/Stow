"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, House, PiggyBank, UserRound } from "lucide-react";

const navigationItems = [
  { label: "Home", href: "/app", icon: House },
  { label: "Savings", href: "/app/savings", icon: PiggyBank },
  { label: "Activity", href: "/app/activity", icon: Activity },
  { label: "Profile", href: "/app/profile", icon: UserRound },
] as const;

function isActiveRoute(pathname: string, href: string) {
  return href === "/app" ? pathname === href : pathname.startsWith(href);
}

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="App navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {navigationItems.map(({ label, href, icon: Icon }) => {
          const active = isActiveRoute(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 px-2 py-2 text-xs font-medium transition-colors ${
                active ? "text-brand" : "text-muted hover:text-foreground"
              }`}
            >
              <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}