type AppleWalletButtonProps = {
  passUrl: string;
  className?: string;
};

/**
 * "Add to Apple Wallet" button following official Apple brand guidelines.
 * Uses the standard black pill shape with the Apple Wallet logo inline SVG.
 */
export function AppleWalletButton({ passUrl, className = "" }: AppleWalletButtonProps) {
  return (
    <a
      href={passUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-[12px] bg-black px-5 py-3 text-white no-underline transition-transform active:scale-[0.97] hover:bg-[#1a1a1a] ${className}`}
      aria-label="Add to Apple Wallet"
    >
      {/* Apple Wallet icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="30"
        height="30"
        fill="none"
      >
        {/* Wallet card stack */}
        <rect x="3" y="4" width="18" height="16" rx="3" ry="3" fill="#1C1C1E" stroke="#fff" strokeWidth="1.2" />
        <rect x="3" y="4" width="18" height="4" rx="2" ry="0" fill="#FF3B30" />
        <rect x="3" y="7.5" width="18" height="3.5" rx="0" ry="0" fill="#FF9500" />
        <rect x="3" y="10.5" width="18" height="3.5" rx="0" ry="0" fill="#FFCC00" />
        <rect x="3" y="13.5" width="18" height="3" rx="0" ry="0" fill="#34C759" />
        <rect x="3" y="16" width="18" height="4" rx="0" ry="3" fill="#007AFF" />
        {/* Apple logo */}
        <g transform="translate(8.5, 5.5) scale(0.32)">
          <path
            d="M15.769 7.404c-.678.762-1.785 1.353-2.691 1.353-.127 0-.254-.015-.37-.042-.021-.127-.042-.317-.042-.508 0-.932.551-1.93 1.016-2.543.678-.804 1.87-1.417 2.84-1.459.021.149.042.339.042.529 0 .889-.423 1.837-1.016 2.67h.221zm3.305 12.83c-.741 1.141-1.509 2.268-2.712 2.289-.593.014-1.016-.339-1.636-.339-.629 0-1.101.325-1.651.353-1.141.042-2.014-1.232-2.769-2.367-1.537-2.31-2.72-6.523-1.134-9.37.783-1.396 2.183-2.282 3.704-2.31.7-.014 1.375.466 1.808.466.424 0 1.226-.578 2.07-.494.35.014 1.34.141 1.974.863-.049.042-1.176.691-1.162 2.056.014 1.634 1.431 2.183 1.445 2.183-.014.042-.226.777-.741 1.539-.424.678-.87 1.36-1.564 1.375-.338.007-.564-.178-.877-.178-.317 0-.609.184-.969.184-.339 0-.598-.169-.932-.514"
            fill="white"
          />
        </g>
      </svg>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[10px] font-normal tracking-wide opacity-90">Add to</span>
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Apple Wallet</span>
      </span>
    </a>
  );
}
