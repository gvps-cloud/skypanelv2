import tailwindcssAnimate from "tailwindcss-animate";
import { fontFamily } from "tailwindcss/defaultTheme";
import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
    	container: {
    		center: true,
    		padding: '2rem',
    		screens: {
    			'2xl': '1400px'
    		}
    	},
    	extend: {
    		colors: {
				blue: colors.teal,
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			sidebar: {
    				DEFAULT: 'hsl(var(--sidebar-background))',
    				foreground: 'hsl(var(--sidebar-foreground))',
    				primary: 'hsl(var(--sidebar-primary))',
    				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
    				accent: 'hsl(var(--sidebar-accent))',
    				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
    				border: 'hsl(var(--sidebar-border))',
    				ring: 'hsl(var(--sidebar-ring))'
    			},
    			success: {
    				DEFAULT: 'hsl(var(--success))',
    				foreground: 'hsl(var(--success-foreground))'
    			},
    			info: {
    				DEFAULT: 'hsl(var(--info))',
    				foreground: 'hsl(var(--info-foreground))'
    			},
    			warning: {
    				DEFAULT: 'hsl(var(--warning))',
    				foreground: 'hsl(var(--warning-foreground))'
    			},
    			"accent-orange": 'hsl(var(--accent-orange))',
    			"accent-purple": 'hsl(var(--accent-purple))',
    			chart: {
    				1: 'hsl(var(--chart-1))',
    				2: 'hsl(var(--chart-2))',
    				3: 'hsl(var(--chart-3))',
    				4: 'hsl(var(--chart-4))',
    				5: 'hsl(var(--chart-5))'
    			}
    		},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		fontFamily: {
    			sans: [
    				'var(--font-sans)',
                    ...fontFamily.sans
                ]
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
    			},
    			'mobile-slide-up': {
    				from: {
    					opacity: '0',
    					transform: 'translate3d(0, 100%, 0)'
    				},
    				to: {
    					opacity: '1',
    					transform: 'translate3d(0, 0, 0)'
    				}
    			},
    			'mobile-slide-down': {
    				from: {
    					opacity: '1',
    					transform: 'translate3d(0, 0, 0)'
    				},
    				to: {
    					opacity: '0',
    					transform: 'translate3d(0, 100%, 0)'
    				}
    			},
    			'mobile-fade-in': {
    				from: {
    					opacity: '0'
    				},
    				to: {
    					opacity: '1'
    				}
    			},
    			'mobile-fade-out': {
    				from: {
    					opacity: '1'
    				},
    				to: {
    					opacity: '0'
    				}
    			}
    		},
    		animation: {
    			'accordion-down': 'accordion-down 0.2s ease-out',
    			'accordion-up': 'accordion-up 0.2s ease-out',
    			'mobile-slide-up': 'mobile-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    			'mobile-slide-down': 'mobile-slide-down 0.2s cubic-bezier(0.4, 0, 1, 1)',
    			'mobile-fade-in': 'mobile-fade-in 0.2s ease-out',
    			'mobile-fade-out': 'mobile-fade-out 0.15s ease-in'
    		}
    	}
    },
  plugins: [tailwindcssAnimate, require("@tailwindcss/typography")],
};

export default config;
