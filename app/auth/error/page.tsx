"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Error() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="container flex flex-col items-center justify-center gap-4 px-4 py-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold tracking-tight">Error</h1>
          <p className="text-sm text-muted-foreground">
            Hubo un error al iniciar sesión. Por favor, inténtalo de nuevo.
          </p>
        </div>
        <Button 
          onClick={() => router.push("/auth/signin")}
          className="mt-4"
        >
          Volver a intentar
        </Button>
      </div>
    </div>
  );
}