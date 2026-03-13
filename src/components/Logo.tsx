const Logo = ({ className = "h-8 w-8" }: { className?: string }) => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="hsl(35, 80%, 50%)" />
        <stop offset="1" stopColor="hsl(350, 70%, 45%)" />
      </linearGradient>
    </defs>
    {/* Hanger shape */}
    <path
      d="M24 8a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5L38 26a2 2 0 0 1-1.2 3.6H11.2A2 2 0 0 1 10 26l12-10.5A4 4 0 0 1 24 8z"
      stroke="url(#logo-grad)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Sparkle - AI indicator */}
    <path
      d="M38 10l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"
      fill="url(#logo-grad)"
    />
    {/* Closet body */}
    <rect
      x="12"
      y="30"
      width="24"
      height="12"
      rx="3"
      stroke="url(#logo-grad)"
      strokeWidth="2.2"
      fill="none"
    />
    <line x1="24" y1="30" x2="24" y2="42" stroke="url(#logo-grad)" strokeWidth="1.5" />
    {/* Door handles */}
    <circle cx="21" cy="36" r="1" fill="url(#logo-grad)" />
    <circle cx="27" cy="36" r="1" fill="url(#logo-grad)" />
  </svg>
);

export default Logo;
