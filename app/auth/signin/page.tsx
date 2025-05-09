"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user) {
      router.push("/");
    }
  }, [session, router]);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn("github", {
        callbackUrl: "/",
      });
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Bienvenido</h1>
          <p className="text-sm text-muted-foreground">
            Inicia sesión con tu cuenta de GitHub para continuar
          </p>
        </div>
        <Card className="w-full max-w-md">
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                Iniciar Sesión
              </h2>
              <p className="text-sm text-muted-foreground">
                Para acceder a tu cuenta de Finanzapp
              </p>
            </div>
            <Button
              onClick={handleSignIn}
              className={cn(
                "flex w-full justify-center gap-2",
                "bg-gray-800 hover:bg-gray-700 text-white"
              )}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <svg
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Iniciar sesión con GitHub</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}