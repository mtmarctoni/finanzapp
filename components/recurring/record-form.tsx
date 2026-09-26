'use client';

import { useEffect, useState } from 'react';

import { type RecurringFormData } from '@/components/recurring/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  'Ingreso',
  'Gasto',
  'Inversión',
];

export function RecordForm({
  formData,
  loading,
  isEditing,
  onChange,
  onCancel,
  onSubmit,
}: RecordFormProps) {
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
    <div className="mt-4 border rounded-lg p-4 sm:p-5 space-y-4">
      <h3 className="font-semibold text-lg">
        {isEditing ? 'Editar registro recurrente' : 'Crear registro recurrente'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Nombre</label>
          <Input
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            placeholder="Ej: Alquiler"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Tipo de transacción
          </label>
          <Select
            value={formData.accion}
            onValueChange={(value) =>
              onChange({
                ...formData,
                accion: value as RecurringRecord['accion'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {transactionOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Día del mes</label>
          <Select
            value={formData.dia.toString()}
            onValueChange={(value) =>
              onChange({ ...formData, dia: parseInt(value, 10) })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar día" />
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
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Categoría</label>
          <Combobox
            options={categoryOptions}
            value={formData.tipo}
            onChange={(value) => onChange({ ...formData, tipo: value })}
            placeholder="Seleccionar categoría"
            loading={optionsLoading}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Monto</label>
          <Input
            type="number"
            value={formData.amount}
            onChange={(e) => onChange({ ...formData, amount: e.target.value })}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-medium">Detalle 1</label>
          <Input
            value={formData.detalle1}
            onChange={(e) =>
              onChange({ ...formData, detalle1: e.target.value })
            }
            placeholder="Detalle principal"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-medium">Detalle 2</label>
          <Input
            value={formData.detalle2}
            onChange={(e) =>
              onChange({ ...formData, detalle2: e.target.value })
            }
            placeholder="Detalle adicional"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="block text-sm font-medium">Quién</label>
          <Input
            value={formData.quien}
            onChange={(e) => onChange({ ...formData, quien: e.target.value })}
            placeholder="Ej: Yo, María, Juan"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Frecuencia</label>
          <Select
            value={formData.frequency}
            onValueChange={(value) =>
              onChange({
                ...formData,
                frequency: value as RecurringRecord['frequency'],
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar frecuencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="biweekly">Cada 2 semanas</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <label className="block text-sm font-medium">
            Plataforma de pago
          </label>
          <Input
            value={formData.plataforma_pago}
            onChange={(e) =>
              onChange({ ...formData, plataforma_pago: e.target.value })
            }
            placeholder="Ej: Transferencia, Tarjeta"
          />
        </div>

        <div className="space-y-2 lg:col-span-1">
          <label className="block text-sm font-medium">Estado</label>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 h-10">
            <Checkbox
              checked={formData.active}
              onCheckedChange={(checked) =>
                onChange({ ...formData, active: checked as boolean })
              }
            />
            <span className="text-sm">Activo</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button onClick={onSubmit} disabled={loading}>
          {isEditing ? 'Guardar cambios' : 'Añadir registro'}
        </Button>
      </div>
    </div>
  );
}
