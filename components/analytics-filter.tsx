import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfYear, endOfYear, subMonths, startOfMonth, endOfMonth } from "date-fns";

export interface AnalyticsFilterValue {
  search?: string;
  actions?: string | string[];
  categories?: string | string[];
  platforms?: string | string[];
  types?: string | string[];
  minAmount?: number;
  maxAmount?: number;
  from?: Date;
  to?: Date;
  groupBy?: "month" | "year";
  useActivePeriods?: boolean;
}

export interface AnalyticsFilterProps {
  value: AnalyticsFilterValue;
  onChange: (filters: AnalyticsFilterValue) => void;
  actions: string[];
  categories: string[];
  platforms: (string | null | undefined)[];
  types: (string | null | undefined)[];
  years: number[];
}

export function AnalyticsFilter({ value, onChange, actions, categories, platforms, types, years }: AnalyticsFilterProps) {
  const [open, setOpen] = useState(false);
  const now = new Date();

  // Quick date filter handlers
  const setMonths = (n: number) => {
    const from = startOfMonth(subMonths(now, n - 1));
    const to = endOfMonth(now);
    onChange({ ...value, from, to });
  };
  const setYTD = () => {
    onChange({ ...value, from: startOfYear(now), to: endOfMonth(now) });
  };
  const setYear = (year: number) => {
    onChange({ ...value, from: startOfYear(new Date(year, 0, 1)), to: endOfYear(new Date(year, 0, 1)) });
  };

  return (
    <div className="flex flex-wrap gap-2 items-end mb-4">
      <Input
        placeholder="Buscar..."
        value={value.search || ""}
        onChange={e => onChange({ ...value, search: e.target.value })}
        className="w-40"
      />
      <Select
        value={Array.isArray(value.actions) ? value.actions[0] || "" : value.actions || ""}
        onValueChange={action => onChange({ ...value, actions: action })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Acciones" />
        </SelectTrigger>
        <SelectContent>
          {actions.map(a => (
            <SelectItem key={a} value={a}>{a}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={Array.isArray(value.categories) ? value.categories[0] || "" : value.categories || ""}
        onValueChange={category => onChange({ ...value, categories: category })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Categorías" />
        </SelectTrigger>
        <SelectContent>
          {categories.map(c => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={Array.isArray(value.platforms) ? value.platforms[0] || "" : value.platforms || ""}
        onValueChange={platform => onChange({ ...value, platforms: platform })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Plataformas" />
        </SelectTrigger>
        <SelectContent>
          {platforms.filter((p): p is string => p !== null && p !== undefined).map(p => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={Array.isArray(value.types) ? value.types[0] || "" : value.types || ""}
        onValueChange={type => onChange({ ...value, types: type })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Tipos" />
        </SelectTrigger>
        <SelectContent>
          {types.filter((t): t is string => t !== null && t !== undefined).map(t => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        placeholder="Mín. €"
        value={value.minAmount ?? ""}
        onChange={e => onChange({ ...value, minAmount: e.target.value ? Number(e.target.value) : undefined })}
        className="w-24"
      />
      <Input
        type="number"
        placeholder="Máx. €"
        value={value.maxAmount ?? ""}
        onChange={e => onChange({ ...value, maxAmount: e.target.value ? Number(e.target.value) : undefined })}
        className="w-24"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-36">
            {value.from && value.to
              ? `${format(value.from, "dd/MM/yyyy")} - ${format(value.to, "dd/MM/yyyy")}`
              : "Rango de fechas"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0">
          <Calendar
            mode="range"
            selected={value.from && value.to ? { from: value.from, to: value.to } : undefined}
            onSelect={(range) => {
              if (range && typeof range === 'object' && 'from' in range && 'to' in range) {
                onChange({ ...value, from: range.from as Date, to: range.to as Date });
              }
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <div className="flex gap-1">
        {[1, 3, 6, 12].map(m => (
          <Button key={m} size="sm" variant="ghost" onClick={() => setMonths(m)}>{m}m</Button>
        ))}
        <Button size="sm" variant="ghost" onClick={setYTD}>YTD</Button>
        {years.map(y => (
          <Button key={y} size="sm" variant="ghost" onClick={() => setYear(y)}>{y}</Button>
        ))}
      </div>
      <Select
        value={value.groupBy || "month"}
        onValueChange={groupBy => onChange({ ...value, groupBy: groupBy as "month" | "year" })}
      >
        <SelectTrigger className="w-28">
          <SelectValue placeholder="Agrupar por" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="month">Mes</SelectItem>
          <SelectItem value="year">Año</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant={value.useActivePeriods ? "default" : "outline"}
        onClick={() => onChange({ ...value, useActivePeriods: !value.useActivePeriods })}
      >
        {value.useActivePeriods ? "Solo periodos activos" : "Todos los periodos"}
      </Button>
      <Button variant="ghost" onClick={() => onChange({})}>Limpiar</Button>
    </div>
  );
}
