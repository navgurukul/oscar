/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'Figtree',
  				'system-ui',
  				'sans-serif'
  			],
  			serif: [
  				'EB Garamond',
  				'Georgia',
  				'serif'
  			],
  			mono: [
  				'IBM Plex Mono',
  				'ui-monospace',
  				'monospace'
  			]
  		},
  		colors: {
			/* Editorial cream/ink/terracotta palette mirrors web v2. Legacy
			 * `cyan` + `sky` utility names are aliased onto
			 * terracotta + cream so existing utility classes flip automatically. */
  			cream: {
  				DEFAULT: '#f7f4ee',
  				50: '#faf8f3',
  				100: '#f7f4ee',
  				200: '#efeae0',
  				300: '#e5e0d6',
  				400: '#d8d2c4'
  			},
  			ink: {
  				DEFAULT: '#1a1816',
  				soft: '#5a5852',
  				faint: '#8b8780',
  				night: '#0f0d0a'
  			},
  			terracotta: {
  				DEFAULT: '#b8623d',
  				50: '#f7e6dd',
  				100: '#e8c9b8',
  				500: '#b8623d',
  				600: '#a25234',
  				700: '#823f24'
  			},
  			cyan: {
  				50: '#faf8f3',
  				100: '#f7e6dd',
  				200: '#e8c9b8',
  				300: '#e8c9b8',
  				400: '#b8623d',
  				500: '#b8623d',
  				600: '#a25234',
  				700: '#823f24',
  				800: '#1a1816',
  				900: '#1a1816'
  			},
  			sky: {
  				50: '#efeae0',
  				100: '#e8c9b8',
  				500: '#b8623d',
  				600: '#a25234'
  			},
  			/* Cool slate aliased to warm ink/cream so existing utility refs
  			 * (`text-slate-500`, `bg-slate-100`, `border-slate-200`, etc.) pick
  			 * up the cream palette without per-file refactors. */
  			slate: {
  				50: '#faf8f3',
  				100: '#efeae0',
  				200: '#e5e0d6',
  				300: '#d8d2c4',
  				400: '#8b8780',
  				500: '#5a5852',
  				600: '#5a5852',
  				700: '#1a1816',
  				800: '#1a1816',
  				900: '#1a1816',
  				950: '#0f0d0a'
  			},
  			gray: {
  				50: '#faf8f3',
  				100: '#efeae0',
  				200: '#e5e0d6',
  				300: '#d8d2c4',
  				400: '#8b8780',
  				500: '#5a5852',
  				600: '#5a5852',
  				700: '#1a1816',
  				800: '#1a1816',
  				900: '#1a1816'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
