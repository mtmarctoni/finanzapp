import { redirect } from "next/navigation"

export default async function Home({
  searchParams,
}: {
  searchParams?: {
    search?: string
    accion?: string
    from?: string
    to?: string
    page?: string
  }
}) {
  redirect("/dashboard")
}
