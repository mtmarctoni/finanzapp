"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

type ApiKeyItem = {
  id: string
  user_id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_used_at: string | null
}

function formatDate(value: string | null) {
  if (!value) return "Nunca"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Fecha inválida"

  return date.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export function ApiKeyManager() {
  const { toast } = useToast()
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const activeKeys = useMemo(
    () => apiKeys.filter((item) => item.is_active),
    [apiKeys]
  )

  const loadApiKeys = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch("/api/api-keys", { cache: "no-store" })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "No se pudieron cargar las llaves")
      }

      setApiKeys(payload.data ?? [])
    } catch (error) {
      console.error("Failed to load API keys:", error)
      toast({
        title: "No se pudieron cargar las llaves",
        description: "Recarga la página e inténtalo otra vez.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadApiKeys()
  }, [loadApiKeys])

  const handleCreateKey = async () => {
    const trimmedName = newKeyName.trim()

    if (!trimmedName) {
      toast({
        title: "Nombre requerido",
        description: "Ponle un nombre claro a la integración, por ejemplo Zapier o n8n.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo crear la llave")
      }

      setGeneratedKey(payload.data.plaintext)
      setApiKeys((current) => [
        {
          id: payload.data.id,
          user_id: "",
          name: payload.data.name,
          is_active: payload.data.is_active,
          created_at: payload.data.created_at,
          updated_at: payload.data.updated_at,
          last_used_at: payload.data.last_used_at,
        },
        ...current,
      ])
      setNewKeyName("")

      toast({
        title: "Llave creada",
        description: "Guárdala ahora. Después no se vuelve a mostrar.",
      })
    } catch (error) {
      console.error("Failed to create API key:", error)
      toast({
        title: "No se pudo crear la llave",
        description: "Revisa el nombre y vuelve a intentar.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevokeKey = async (id: string) => {
    setRevokingId(id)

    try {
      const response = await fetch(`/api/api-keys/${id}`, {
        method: "DELETE",
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || "No se pudo revocar la llave")
      }

      setApiKeys((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                is_active: false,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      )

      toast({
        title: "Llave revocada",
        description: "Las apps externas ya no podrán usar esta integración.",
      })
    } catch (error) {
      console.error("Failed to revoke API key:", error)
      toast({
        title: "No se pudo revocar la llave",
        description: "Inténtalo otra vez en unos segundos.",
        variant: "destructive",
      })
    } finally {
      setRevokingId(null)
    }
  }

  const handleCopyKey = async () => {
    if (!generatedKey) return

    try {
      await navigator.clipboard.writeText(generatedKey)
      toast({
        title: "Llave copiada",
        description: "Ya la puedes pegar en tu otra app.",
      })
    } catch (error) {
      console.error("Failed to copy API key:", error)
      toast({
        title: "No se pudo copiar",
        description: "Cópiala manualmente antes de cerrar este mensaje.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <KeyRound className="h-5 w-5" />
              API pública
            </CardTitle>
            <CardDescription>
              Crea llaves para que otras apps registren movimientos sin tocar la base de datos desde el cliente.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadApiKeys}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Recargar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {generatedKey && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Guarda esta llave ahora</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>Solo se muestra una vez. Si la pierdes, tendrás que revocarla y crear otra.</p>
              <div className="rounded-md border bg-muted/40 p-3 font-mono text-xs break-all">
                {generatedKey}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCopyKey}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar llave
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setGeneratedKey(null)}>
                  Ocultar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg border p-4">
          <div className="mb-4 space-y-1">
            <h3 className="font-medium">Nueva llave</h3>
            <p className="text-sm text-muted-foreground">
              Usa un nombre que te diga exactamente dónde vive. Ejemplo: n8n gastos o webhook del banco.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={newKeyName}
              onChange={(event) => setNewKeyName(event.target.value)}
              placeholder="Ejemplo: Zapier personal"
              aria-label="Nombre de la nueva llave"
            />
            <Button onClick={handleCreateKey} disabled={submitting} className="sm:min-w-40">
              {submitting ? "Creando..." : "Crear llave"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Llaves activas</h3>
            <span className="text-sm text-muted-foreground">
              {activeKeys.length} activas
            </span>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Cargando llaves...
            </div>
          ) : activeKeys.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Aún no tienes llaves creadas.
            </div>
          ) : (
            <div className="space-y-3">
              {activeKeys.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Creada: {formatDate(item.created_at)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Último uso: {formatDate(item.last_used_at)}
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevokeKey(item.id)}
                    disabled={revokingId === item.id}
                    aria-label={`Revocar llave ${item.name}`}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {revokingId === item.id ? "Revocando..." : "Revocar"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
