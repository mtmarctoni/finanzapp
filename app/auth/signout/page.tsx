"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SignOut() {
  const router = useRouter();

  useEffect(() => {
    // Sign out the user
    signOut({
      callbackUrl: "/auth/signin",
      redirect: true,
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="container flex flex-col items-center justify-center gap-4 px-4 py-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold tracking-tight">Cerrando sesión...</h1>
          <p className="text-sm text-muted-foreground">
            Estamos cerrando tu sesión. Serás redirigido al inicio de sesión.
          </p>
        </div>
        <Button
          onClick={() => {
            signOut({ callbackUrl: "/auth/signin" });
          }}
          className="mt-4"
        >
          Cerrar sesión ahora
        </Button>
      </div>
    </div>
  );
}