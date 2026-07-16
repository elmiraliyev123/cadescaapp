type GoogleWalletButtonProps = {
  passUrl: string;
  className?: string;
  label?: string;
};

/**
 * "Add to Google Wallet" button following official Google Wallet brand guidelines.
 * Uses the standard black pill shape with the Google Wallet "G" logo inline SVG.
 */
export function GoogleWalletButton({ passUrl, className = "", label = "Add to Google Wallet" }: GoogleWalletButtonProps) {
  return (
    <a
      href={passUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2.5 rounded-[12px] bg-black px-5 py-3 text-white no-underline transition-transform active:scale-[0.97] hover:bg-[#1a1a1a] ${className}`}
      aria-label={label}
    >
      {/* Google Wallet icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="26"
        height="26"
        fill="none"
      >
        {/* Simplified Google Wallet logo — card fan */}
        <g transform="translate(2, 2) scale(0.83)">
          {/* Blue card (back) */}
          <rect x="3" y="2" width="18" height="12" rx="2.5" fill="#4285F4" transform="rotate(-8 12 8)" />
          {/* Red card (middle) */}
          <rect x="3" y="5" width="18" height="12" rx="2.5" fill="#EA4335" transform="rotate(-3 12 11)" />
          {/* Yellow card (front-middle) */}
          <rect x="3" y="7" width="18" height="12" rx="2.5" fill="#FBBC04" transform="rotate(1 12 13)" />
          {/* Green card (front) */}
          <rect x="3" y="9" width="18" height="12" rx="2.5" fill="#34A853" transform="rotate(4 12 15)" />
        </g>
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">{label}</span>
    </a>
  );
}
