"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { HomeIcon, PlusCircle, UserIcon } from "lucide-react"
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("github", {
        callbackUrl: "/",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut({
        callbackUrl: "/auth/signin",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span className="text-primary">Finanzas Personales</span>
        </Link>
        <nav className="flex gap-4">
          {/* Profile Button */}
          {session ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/user")}
              className="ml-2"
            >
              <UserIcon className="h-5 w-5" />
            </Button>
          ) : null}
           {/* Authentication */}
           {session ? (
              <Button
                variant="outline"
                onClick={handleSignOut}
                disabled={isLoading}
                className="ml-4"
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  "Cerrar sesión"
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleSignIn}
                disabled={isLoading}
                className="ml-4"
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  "Iniciar sesión"
                )}
              </Button>
            )}
          
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

