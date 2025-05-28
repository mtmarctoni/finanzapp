import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Navbar } from "@/components/navbar"
import { Sidebar } from "@/components/sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { Toaster } from "@/components/ui/toaster"
import AuthProvider from "@/components/context/AuthProvider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Finanzas Personales",
  description: "Aplicación para gestionar finanzas personales",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <div className="flex min-h-screen flex-col lg:flex-row">
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <Navbar />
              <main className="flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-6 lg:pt-6 safe-bottom">
                <div className="mx-auto w-full max-w-7xl">
                  {children}
                </div>
              </main>
              <MobileNav />
            </div>
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}