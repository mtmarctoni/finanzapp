'use client';

import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function DatePicker({
  className,
  selected,
  onSelect,
  placeholder = 'Select date',
  ...props
}: {
  className?: string;
  selected: Date | null | undefined;
  onSelect?: (date: Date | null | undefined) => void;
  placeholder?: string;
  [key: string]: any;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
          {...props}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, 'PPP', { locale: es }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected || undefined}
          onSelect={onSelect}
          initialFocus
          locale={es}
        />
      </PopoverContent>
    </Popover>
  );
}

const es = {
  code: 'es',
  formatDistance: (() => {
    const formatDistanceLocale: any = {
      xSeconds: 'hace {{count}}s',
      xMinutes: 'hace {{count}}m',
      xHours: 'hace {{count}}h',
      xDays: 'hace {{count}}d',
      xMonths: 'hace {{count}}m',
      xYears: 'hace {{count}}a',
    };

    return (token: string, count: number) => 
      formatDistanceLocale[token].replace('{{count}}', count);
  })(),
  formatRelative: (token: string) => {
    const formatRelativeLocale: any = {
      lastWeek: "'la' eeee 'pasado a las' p",
      yesterday: "'ayer a las' p",
      today: "'hoy a las' p",
      tomorrow: "'mañana a las' p",
      nextWeek: "eeee 'a las' p",
      other: 'P',
    };
    return formatRelativeLocale[token];
  },
  localize: {
    month: (n: number) => {
      const months = [
        'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
      ];
      return months[n];
    },
    day: (n: number) => {
      const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      return days[n];
    },
    dayPeriod: (period: string) => period === 'am' ? 'a. m.' : 'p. m.',
    ordinalNumber: (n: number) => `${n}º`,
    era: (n: number) => n === 0 ? 'antes de Cristo' : 'después de Cristo',
    quarter: (n: number) => {
      const quarters = ['1er trimestre', '2do trimestre', '3er trimestre', '4to trimestre'];
      return quarters[n - 1];
    },
  },
  formatLong: {
    date: () => 'dd/MM/yyyy',
    time: () => 'HH:mm',
    dateTime: () => 'dd/MM/yyyy HH:mm',
  },
};
