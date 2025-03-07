import Link from "next/link"
import { Button } from "@/components/ui/button"
import { HomeIcon, PlusCircle } from "lucide-react"

export function Navbar() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-primary">Finanzas Personales</span>
        </Link>
        <nav className="flex gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <HomeIcon className="mr-2 h-4 w-4" />
              Inicio
            </Button>
          </Link>
          <Link href="/new">
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Entrada
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  )
}

