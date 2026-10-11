/** All artwork fits inside the central maskable safe circle (40% radius). */
export function AppIcon() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: '#000000',
      }}
    >
      <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none">
        <rect x="8" y="22" width="84" height="60" rx="16" fill="#d4ff3a" />
        <path
          d="M24 22V18C24 12 29 8 35 8H73V22"
          stroke="#d4ff3a"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <rect x="60" y="40" width="32" height="26" rx="8" fill="#000000" />
        <circle cx="73" cy="53" r="4" fill="#d4ff3a" />
      </svg>
    </div>
  );
}
