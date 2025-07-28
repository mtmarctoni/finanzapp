"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Repeat, BarChart3, Home, PlusCircle } from "lucide-react"
import { Button } from "./ui/button"

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
  // {
  //   name: "Dashboard",
  //   href: "/dashboard",
  //   icon: LayoutDashboard,
  // },
  {
    name: "Gastos Recurrentes",
    href: "/recurring",
    icon: Repeat,
  },
  {
    name: "Análisis",
    href: "/analytics",
    icon: BarChart3,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden border-r bg-muted/40 lg:block w-64 flex-shrink-0">
      <div className="flex h-screen flex-col gap-2 sticky top-0">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="text-primary">Finanzas</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    isActive && "bg-muted text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
            <div className="mt-4">
              <Link href="/new">
                <Button size="sm" className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Nueva Transacción
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </div>
  )
}
