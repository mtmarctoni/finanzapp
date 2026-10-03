'use client';

import { useEffect, useId, useState } from 'react';

import { type RecurringFormData } from '@/components/recurring/types';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { type RecurringRecord } from '@/types/finance';

interface RecordFormProps {
  formData: RecurringFormData;
  loading: boolean;
  isEditing: boolean;
  onChange: (next: RecurringFormData) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

const transactionOptions: RecurringRecord['accion'][] = [
  'Gasto',
  'Ingreso',
  'Inversión',
];

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block px-1 text-[13px] font-medium text-subtle"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export function RecordForm({
  formData,
  loading,
  isEditing,
  onChange,
  onCancel,
  onSubmit,
}: RecordFormProps) {
  const id = useId();
  // Categories come from the shared `categories` table, the same source the
  // /records form uses, so a category is never missing from one screen but
  // present on the other.
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const response = await fetch('/api/options');
        if (response.ok) {
          const data = await response.json();
          setCategoryOptions(data.tipo ?? []);
        }
      } catch (error) {
        console.error('Failed to fetch category options:', error);
      } finally {
        setOptionsLoading(false);
      }
    };

    fetchOptions();
  }, []);

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="pr-10 text-[22px] font-semibold tracking-[-0.03em]">
        {isEditing ? 'Editar registro recurrente' : 'Crear registro recurrente'}
      </h2>

      <div
        role="radiogroup"
        aria-label="Tipo de transacción"
        className="grid grid-cols-3 gap-1 rounded-[14px] bg-surface-2 p-1"
      >
        {transactionOptions.map((option) => {
          const active = formData.accion === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ ...formData, accion: option })}
              className={cn(
                'h-10 rounded-[10px] text-[13px] font-semibold transition-colors',
                active
                  ? 'bg-surface-4 text-foreground shadow-sm'
                  : 'text-subtle hover:text-foreground',
              )}
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" htmlFor={`${id}-name`} className="col-span-2">
          <Input
            id={`${id}-name`}
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            placeholder="Ej: Alquiler"
          />
        </Field>

        <Field label="Importe" htmlFor={`${id}-amount`}>
          <div className="relative">
            <Input
              id={`${id}-amount`}
              type="number"
              inputMode="decimal"
              value={formData.amount}
              onChange={(e) =>
                onChange({ ...formData, amount: e.target.value })
              }
              placeholder="0,00"
              className="num pr-8"
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] text-faint">
              €
            </span>
          </div>
        </Field>

        <Field label="Categoría">
          <Combobox
            options={categoryOptions}
            value={formData.tipo}
            onChange={(value) => onChange({ ...formData, tipo: value })}
            placeholder="Seleccionar categoría"
            loading={optionsLoading}
          />
        </Field>

        <Field label="Frecuencia">
          <Select
            value={formData.frequency}
            onValueChange={(value) =>
              onChange({
                ...formData,
                frequency: value as RecurringRecord['frequency'],
              })
            }
          >
            <SelectTrigger aria-label="Frecuencia">
              <SelectValue placeholder="Frecuencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="biweekly">Cada 2 semanas</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Día del mes">
          <Select
            value={formData.dia.toString()}
            onValueChange={(value) =>
              onChange({ ...formData, dia: parseInt(value, 10) })
            }
          >
            <SelectTrigger aria-label="Día del mes">
              <SelectValue placeholder="Día" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, index) => index + 1).map(
                (day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Plataforma de pago" htmlFor={`${id}-platform`}>
          <Input
            id={`${id}-platform`}
            value={
              formData.plataforma_pago === 'any' ? '' : formData.plataforma_pago
            }
            onChange={(e) =>
              onChange({
                ...formData,
                plataforma_pago: e.target.value || 'any',
              })
            }
            placeholder="Tarjeta, transferencia"
          />
        </Field>

        <Field label="Quién" htmlFor={`${id}-quien`}>
          <Input
            id={`${id}-quien`}
            value={formData.quien}
            onChange={(e) => onChange({ ...formData, quien: e.target.value })}
            placeholder="Yo"
          />
        </Field>

        <Field label="Detalle" htmlFor={`${id}-d1`} className="col-span-2">
          <Input
            id={`${id}-d1`}
            value={formData.detalle1}
            onChange={(e) =>
              onChange({ ...formData, detalle1: e.target.value })
            }
            placeholder="Ej: Empresa S.A."
          />
        </Field>

        <Field label="Nota" htmlFor={`${id}-d2`} className="col-span-2">
          <Input
            id={`${id}-d2`}
            value={formData.detalle2}
            onChange={(e) =>
              onChange({ ...formData, detalle2: e.target.value })
            }
            placeholder="Opcional"
          />
        </Field>
      </div>

      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-[14px] bg-surface-2 px-4">
        <span>
          <span className="block text-[15px] font-medium">Activo</span>
          <span className="block text-[12px] text-faint">
            Los pausados no generan movimientos
          </span>
        </span>
        <span className="relative inline-flex">
          <input
            type="checkbox"
            role="switch"
            checked={formData.active}
            onChange={(e) =>
              onChange({ ...formData, active: e.target.checked })
            }
            className="peer sr-only"
          />
          <span className="h-[31px] w-[51px] rounded-full bg-surface-4 transition-colors peer-checked:bg-positive peer-focus-visible:ring-2 peer-focus-visible:ring-ring" />
          <span className="absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
      </label>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {isEditing ? 'Guardar cambios' : 'Añadir registro'}
        </Button>
      </div>
    </form>
  );
}
