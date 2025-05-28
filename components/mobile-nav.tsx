"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, LayoutDashboard, Repeat, BarChart3, Plus } from "lucide-react"
import { AnimatedIcon } from "@/components/ui/animated-icon"

type NavItem = {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const navItems: NavItem[] = [
  {
    name: "Inicio",
    href: "/",
    icon: Home,
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Recurrente",
    href: "/recurring",
    icon: Repeat,
  },
  {
    name: "Análisis",
    href: "/analytics",
    icon: BarChart3,
  },
]

export function MobileNav() {
  const pathname = usePathname()

  // Don't show on auth pages
  if (pathname.startsWith("/auth")) return null

  return (
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background/95 backdrop-blur-sm md:hidden">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex flex-1 flex-col items-center justify-center p-2 text-xs font-medium transition-all duration-200",
              isActive 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AnimatedIcon active={isActive}>
              <item.icon className="h-5 w-5" />
            </AnimatedIcon>
            <span className={cn(
              "mt-1 transition-all duration-200",
              isActive ? "scale-100 opacity-100" : "scale-90 opacity-80 group-hover:scale-100 group-hover:opacity-100"
            )}>
              {item.name}
            </span>
            {isActive && (
              <span className="absolute -top-1 h-1 w-6 rounded-full bg-primary" />
            )}
          </Link>
        )
      })}
      <Link
        href="/new"
        className="group absolute -top-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:shadow-xl active:scale-95"
      >
        <Plus className="h-6 w-6 transition-transform group-hover:rotate-90" />
        <span className="sr-only">Nueva Transacción</span>
      </Link>
    </nav>
  )
}
