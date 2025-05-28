"use client"

import { useEffect, useState } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const iconVariants = cva(
  "transition-transform duration-300 ease-in-out",
  {
    variants: {
      active: {
        true: "scale-110",
        false: "scale-100"
      }
    },
    defaultVariants: {
      active: false
    }
  }
)

interface AnimatedIconProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconVariants> {
  active?: boolean
  children: React.ReactNode
}

export function AnimatedIcon({ 
  className, 
  active = false, 
  children,
  ...props 
}: AnimatedIconProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className={cn("h-5 w-5 opacity-0", className)} {...props}>
        {children}
      </div>
    )
  }


  return (
    <div 
      className={cn(
        iconVariants({ active, className }),
        "h-5 w-5"
      )} 
      {...props}
    >
      {children}
    </div>
  )
}
