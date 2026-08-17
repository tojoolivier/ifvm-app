/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // Palette IFVM — docs/design_handoff_web/README.md §Design tokens
        ifvm: {
          "bg-outer": "#efeada",
          "text-tertiary": "#6f6a59",
          "text-weak": "#9a9484",
          "amber": "#e89b2b",
          "amber-text": "#8a6d2f",
          "amber-bg": "#fdf6e7",
          "amber-border": "#f0e2bf",
          "danger": "#c0412b",
          "danger-text": "#a5341c",
          "danger-bg": "#fbe9e5",
          "danger-border": "#f0c4b9",
          "blue-text": "#31567f",
          "blue-bg": "#eaf0f7",
          "blue-border": "#cdddef",
          "green-text": "#235a36",
          "green-bg": "#eaf2ec",
          "green-border": "#cfe0d4",
          "brouillon-text": "#6f6a59",
          "brouillon-bg": "#f4efe2",
          "brouillon-border": "#e0d9c4",
        },
      },
      fontFamily: {
        sans: ["Archivo", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
