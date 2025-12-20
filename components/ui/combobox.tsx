"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"

interface ComboboxProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  allowCreate?: boolean
  loading?: boolean
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seleccionar...",
  allowCreate = true,
  loading = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(inputValue.toLowerCase())
  )

  const exactMatch = options.find(
    (option) => option.toLowerCase() === inputValue.toLowerCase()
  )

  const showCreateOption = allowCreate && inputValue && !exactMatch

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>No se encontraron opciones.</CommandEmpty>
            <CommandGroup>
              {loading ? (
                // Show skeleton items while loading
                Array.from({ length: 5 }).map((_, index) => (
                  <CommandItem key={index} disabled>
                    <Skeleton className="h-4 w-4 mr-2" />
                    <Skeleton className="h-4 flex-1" />
                  </CommandItem>
                ))
              ) : (
                <>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option}
                      value={option}
                      onSelect={() => {
                        onChange(option)
                        setInputValue("")
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === option ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {option}
                    </CommandItem>
                  ))}
                  {showCreateOption && (
                    <CommandItem
                      value={inputValue}
                      onSelect={() => {
                        onChange(inputValue)
                        setInputValue("")
                        setOpen(false)
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Crear "{inputValue}"
                    </CommandItem>
                  )}
                </>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}