"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function UserPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn("github", {
        callbackUrl: "/user",
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="container flex flex-col items-center justify-center gap-4 px-4 py-8">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-3xl font-bold tracking-tight">Bienvenido</h1>
            <p className="text-sm text-muted-foreground">
              Inicia sesión para ver tu perfil
            </p>
          </div>
          <Button
            onClick={handleSignIn}
            className="mt-4"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              "Iniciar sesión"
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Mi Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-32 w-32">
              <AvatarImage src={session.user?.image ?? undefined} />
              <AvatarFallback>{session.user?.name?.[0] ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h2 className="text-2xl font-semibold">
                {session.user?.name}
              </h2>
              <p className="text-muted-foreground">
                {session.user?.email}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium">ID de Usuario</h3>
              <p className="text-muted-foreground">{session.user?.id}</p>
            </div>
            <div>
              <h3 className="font-medium">Estado</h3>
              <p className="text-green-500 font-medium">Conectado</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={handleSignOut}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                "Cerrar sesión"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}