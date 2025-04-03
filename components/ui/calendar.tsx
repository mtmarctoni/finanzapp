"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type CalendarProps = Omit<React.ComponentProps<typeof DayPicker>, 'mode' | 'selected' | 'onSelect'> & {
  showTimePicker?: boolean
  onTimeChange?: (time: { hour: number; minute: number }) => void
  selectedTime?: { hour: number; minute: number }
  mode?: 'single' | 'multiple' | 'range'
  selected?: Date | Date[] | { from: Date; to?: Date } | undefined
  onSelect?: (date: Date | undefined) => void
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  showTimePicker = false,
  onTimeChange,
  selectedTime = { hour: 12, minute: 0 },
  selected,
  onSelect,
  ...props
}: CalendarProps) {
  // Spanish day names - these are now handled via CSS
  const [time, setTime] = React.useState(selectedTime);
  const [selectedDate, setSelectedDate] = React.useState(selected as Date | undefined);
  
  // Handle date selection with visual feedback
  const handleSelect = React.useCallback((date: Date | undefined) => {
    setSelectedDate(date);
    if (onSelect) {
      onSelect(date);
    }
  }, [onSelect]);
  
  // Handle time changes
  React.useEffect(() => {
    if (onTimeChange) {
      onTimeChange(time);
    }
  }, [time, onTimeChange]);
  
  // Update selected date when prop changes
  React.useEffect(() => {
    setSelectedDate(selected as Date | undefined);
  }, [selected]);
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-bold ring-2 ring-primary", // Enhanced selected day
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      locale={es}
      weekStartsOn={1} // Start week on Monday (1) instead of Sunday (0)
      formatters={{
        formatWeekdayName: () => {
          // Return empty string as we'll use our custom day names
          return "";
        }
      }}
      // Use Spanish locale for proper month names
      // Day names are handled via CSS
      mode="single"
      selected={selectedDate as any}
      onSelect={handleSelect as any}
      modifiers={{
        selected: selectedDate,
        today: new Date()
      }}
      footer={
        showTimePicker ? (
          <div className="mt-3 p-3 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4" />
                <span className="text-sm font-medium">Hora:</span>
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="flex-1">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={time.hour}
                  onChange={(e) => setTime({ ...time, hour: parseInt(e.target.value) || 0 })}
                  className="w-full"
                  placeholder="Hora"
                />
              </div>
              <div className="flex items-center">:</div>
              <div className="flex-1">
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={time.minute}
                  onChange={(e) => setTime({ ...time, minute: parseInt(e.target.value) || 0 })}
                  className="w-full"
                  placeholder="Minuto"
                />
              </div>
            </div>
          </div>
        ) : null
      }
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
function useState(selectedTime: { hour: number; minute: number }): [any, any] {
  throw new Error("Function not implemented.")
}

function useCallback(arg0: (date: Date | undefined) => void, arg1: (((date: Date | undefined) => void) | undefined)[]) {
  throw new Error("Function not implemented.")
}

function useEffect(arg0: () => void, arg1: any[]) {
  throw new Error("Function not implemented.")
}

