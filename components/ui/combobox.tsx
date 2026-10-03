'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import * as React from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ITEM = 'min-h-11 rounded-[10px] px-3 text-[15px]';

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
  loading?: boolean;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  allowCreate = true,
  loading = false,
  id,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const exactMatch = options.find(
    (option) => option.toLowerCase() === inputValue.toLowerCase(),
  );

  const showCreateOption = allowCreate && inputValue && !exactMatch;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          // eslint-disable-next-line jsx-a11y/role-has-required-aria-props -- Radix PopoverTrigger injects aria-controls
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-surface-2 px-3.5 text-left text-[15px] transition-colors hover:bg-surface-3 focus-visible:border-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 aria-expanded:border-hairline-strong aria-invalid:border-negative/60',
            value ? 'font-medium text-foreground' : 'text-faint',
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-faint" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] overflow-hidden p-0"
        align="start"
        collisionPadding={16}
      >
        <Command>
          <CommandInput
            placeholder="Buscar..."
            className="h-12 text-base md:text-[15px]"
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList className="max-h-[min(320px,45dvh)] overscroll-contain">
            <CommandEmpty className="py-6 text-center text-[13px] text-subtle">
              No se encontraron opciones.
            </CommandEmpty>
            <CommandGroup>
              {loading ? (
                // Show skeleton items while loading
                Array.from({ length: 5 }).map((_, index) => (
                  // eslint-disable-next-line react/no-array-index-key -- static loading placeholders; identical items that never reorder
                  <CommandItem key={index} disabled className={ITEM}>
                    <Skeleton className="h-4 w-4 mr-2" />
                    <Skeleton className="h-4 flex-1" />
                  </CommandItem>
                ))
              ) : (
                <>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option}
                      className={ITEM}
                      value={option}
                      onSelect={() => {
                        onChange(option);
                        setInputValue('');
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === option ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {option}
                    </CommandItem>
                  ))}
                  {showCreateOption && (
                    <CommandItem
                      className={cn(ITEM, 'text-subtle')}
                      value={inputValue}
                      onSelect={() => {
                        onChange(inputValue);
                        setInputValue('');
                        setOpen(false);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {`Crear "${inputValue}"`}
                    </CommandItem>
                  )}
                </>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
