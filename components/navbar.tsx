"use client"

import { Button } from "@/components/ui/button"
import { UserIcon } from "lucide-react"
import { signIn, signOut, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function Navbar() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn("github", {
        callbackUrl: "/",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut({
        callbackUrl: "/auth/signin",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="font-semibold md:text-lg">
          {session?.user?.name ? `Hola, ${session.user.name}` : 'Finanzas Personales'}
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/user")}
              className="h-9 w-9"
            >
              <UserIcon className="h-5 w-5" />
              <span className="sr-only">Perfil de usuario</span>
            </Button>
          )}
          <Button
            variant={session ? "outline" : "default"}
            onClick={session ? handleSignOut : handleSignIn}
            disabled={isLoading}
            className="h-9"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : session ? (
              "Cerrar sesión"
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}

