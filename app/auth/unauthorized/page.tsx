"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-4xl font-bold tracking-tight">Acceso no autorizado</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Este proyecto está protegido y solo está disponible para usuarios autorizados.
          </p>
        </div>

        <div className="max-w-md text-center">
          <p className="text-muted-foreground">
            Si deseas contribuir o aprender más sobre este proyecto, puedes:
          </p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-muted-foreground">
            <li>
              Visitar el repositorio en GitHub:
              <br />
              <Link
                href="https://github.com/mtmarctoni/finanzapp"
                className="text-primary hover:underline"
                target="_blank"
              >
                github.com/mtmarctoni/finanzapp
              </Link>
            </li>
            <li>
              Abrir una issue para solicitar acceso:
              <br />
              <Link
                href="https://github.com/mtmarctoni/finanzapp/issues/new"
                className="text-primary hover:underline"
                target="_blank"
              >
                Abrir issue
              </Link>
            </li>
          </ul>
        </div>

        <Button
          asChild
          className="mt-8"
        >
          <Link href="https://github.com/mtmarctoni/finanzapp">
            <ExternalLink className="mr-2 h-4 w-4" />
            Ir al repositorio
          </Link>
        </Button>
      </div>
    </div>
  );
}