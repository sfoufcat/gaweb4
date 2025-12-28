import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			'app-bg': 'hsl(var(--app-bg))',
  			'surface': 'hsl(var(--surface))',
  			'surface-elevated': 'hsl(var(--surface-elevated))',
  			'text-primary': 'hsl(var(--text-primary))',
  			'text-secondary': 'hsl(var(--text-secondary))',
  			'text-tertiary': 'hsl(var(--text-muted))',
  			'text-muted': 'hsl(var(--text-muted))',
  			'button-primary': 'hsl(var(--primary))',
  			'button-secondary': 'hsl(var(--surface))',
  			'button-disabled': 'hsl(var(--border))',
  			'border-secondary': 'hsl(var(--border-subtle) / 0.5)',
  			'accent-secondary': 'hsl(var(--accent))',
  			'brand-accent': {
  				DEFAULT: 'var(--brand-accent-light)',
  				dark: 'var(--brand-accent-dark)',
  				foreground: 'var(--brand-accent-light-foreground)',
  				subtle: 'color-mix(in srgb, var(--brand-accent-light) 12%, transparent)',
  			},
  			earth: {
  				'50': '#fbfaf9',
  				'100': '#f5f2ee',
  				'200': '#eaddd1',
  				'300': '#dcc2ad',
  				'400': '#cca083',
  				'500': '#a07855',
  				'600': '#8c6245',
  				'700': '#734d38',
  				'800': '#5e3f30',
  				'900': '#2c2520',
  				'950': '#1a1512'
  			},
  			nature: {
  				'50': '#f2f7f5',
  				'100': '#e1ede9',
  				'500': '#5c8c7d',
  				'900': '#1e2f29'
  			},
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
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-geist-sans)',
  				'sans-serif'
  			],
  			serif: [
  				'var(--font-albert-sans)',
  				'serif'
  			],
  			albert: [
  				'var(--font-albert-sans)',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-geist-mono)',
  				'monospace'
  			]
  		},
	animation: {
			blob: 'blob 10s infinite',
			float: 'float 6s ease-in-out infinite',
			'fade-in-up': 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
			'fadeIn': 'fadeIn 0.4s ease-out forwards',
			'slideIn': 'slideIn 0.3s ease-out forwards'
		},
  		keyframes: {
  			blob: {
  				'0%': {
  					transform: 'translate(0px, 0px) scale(1)'
  				},
  				'33%': {
  					transform: 'translate(30px, -50px) scale(1.05)'
  				},
  				'66%': {
  					transform: 'translate(-20px, 20px) scale(0.95)'
  				},
  				'100%': {
  					transform: 'translate(0px, 0px) scale(1)'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0px)'
  				},
  				'50%': {
  					transform: 'translateY(-10px)'
  				}
  			},
		fadeInUp: {
				'0%': {
					opacity: '0',
					transform: 'translateY(20px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			fadeIn: {
				'0%': {
					opacity: '0',
					transform: 'translateY(8px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			slideIn: {
				'0%': {
					opacity: '0',
					transform: 'translateX(-12px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateX(0)'
				}
			}
		},
  		backgroundImage: {
  			'gradient-luxury': 'linear-gradient(to bottom right, hsl(var(--background)), hsl(var(--surface-elevated)))',
  			'gradient-bronze': 'linear-gradient(to right, hsl(var(--accent)), hsl(28 31% 42%))',
  			glass: 'linear-gradient(to bottom right, hsl(var(--surface) / 0.8), hsl(var(--surface) / 0.4))'
  		},
  		transitionTimingFunction: {
  			'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

