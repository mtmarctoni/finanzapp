import * as React from "react";

// Simple FinanzApp logo: FA in a green circle
export function FinanzAppLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="FinanzApp Logo"
    >
      <circle cx="16" cy="16" r="16" fill="#1FB35E" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="bold"
        fontSize="14"
        fill="#fff"
      >
        FA
      </text>
    </svg>
  );
}
