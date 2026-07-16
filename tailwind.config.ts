import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/store/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        "tertiary-fixed": "#e2e2e4",
        "outline-variant": "#cfc4c5",
        "on-tertiary-container": "#838486",
        "on-primary-fixed-variant": "#474747",
        "inverse-on-surface": "#f0f0f2",
        "inverse-surface": "#2f3132",
        secondary: "#5d5e63",
        "on-secondary-container": "#626267",
        "on-secondary-fixed-variant": "#46464b",
        "on-error": "#ffffff",
        outline: "#7e7576",
        "on-tertiary": "#ffffff",
        primary: "#000000",
        "primary-container": "#1b1b1b",
        "primary-fixed-dim": "#c6c6c6",
        surface: "#f9f9fb",
        "on-error-container": "#93000a",
        "on-surface-variant": "#4c4546",
        "surface-variant": "#e2e2e4",
        "inverse-primary": "#c6c6c6",
        "secondary-container": "#e0dfe4",
        "tertiary-fixed-dim": "#c6c6c8",
        "on-tertiary-fixed-variant": "#454749",
        "on-primary-fixed": "#1b1b1b",
        "secondary-fixed": "#e3e2e7",
        "surface-tint": "#5e5e5e",
        "secondary-fixed-dim": "#c6c6cb",
        "on-secondary": "#ffffff",
        "on-surface": "#1a1c1d",
        "surface-container-low": "#f3f3f5",
        "on-tertiary-fixed": "#1a1c1d",
        "on-primary-container": "#848484",
        "on-background": "#1a1c1d",
        "surface-bright": "#f9f9fb",
        "tertiary-container": "#1a1c1d",
        background: "#f9f9fb",
        "on-primary": "#ffffff",
        "surface-container": "#eeeef0",
        "surface-container-lowest": "#ffffff",
        "error-container": "#ffdad6",
        "surface-dim": "#d9dadc",
        tertiary: "#000000",
        error: "#ba1a1a",
        "surface-container-highest": "#e2e2e4",
        "primary-fixed": "#e2e2e2",
        "on-secondary-fixed": "#1a1b1f",
        "surface-container-high": "#e8e8ea"
      },
      borderRadius: {
        md: "0.5rem",
        lg: "0.625rem",
        xl: "0.75rem"
      },
      spacing: {
        "margin-mobile": "20px",
        "margin-desktop": "64px",
        gutter: "24px",
        "container-max": "1280px",
        "margin-tablet": "32px",
        unit: "8px"
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "Plus Jakarta Sans", "sans-serif"]
      },
      fontSize: {
        "label-md": ["14px", { lineHeight: "20px", letterSpacing: "0.02em", fontWeight: "600" }],
        display: ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "body-md": ["16px", { lineHeight: "24px", letterSpacing: "0", fontWeight: "400" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", letterSpacing: "0", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0.01em", fontWeight: "500" }],
        "body-sm": ["14px", { lineHeight: "20px", letterSpacing: "0", fontWeight: "400" }],
        "title-md": ["16px", { lineHeight: "24px", letterSpacing: "0", fontWeight: "600" }],
        "title-lg": ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "label-lg": ["16px", { lineHeight: "24px", letterSpacing: "0.01em", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "social-page": ["26px", { lineHeight: "32px", letterSpacing: "-0.025em", fontWeight: "650" }],
        "social-section": ["20px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "social-name": ["15px", { lineHeight: "20px", letterSpacing: "0", fontWeight: "600" }],
        "social-body": ["16px", { lineHeight: "24px", letterSpacing: "0", fontWeight: "400" }],
        "social-meta": ["13px", { lineHeight: "20px", letterSpacing: "0", fontWeight: "400" }],
        "social-nav": ["12px", { lineHeight: "16px", letterSpacing: "0", fontWeight: "500" }]
      },
      boxShadow: {
        soft: "0 1px 2px rgba(26, 28, 29, 0.04)",
        md: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)"
      }
    }
  },
  plugins: []
};

export default config;
