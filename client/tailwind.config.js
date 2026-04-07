/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // We will build a dark-mode first app
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Sleek dark mode palette typical for cybersecurity
        base: {
          900: '#0B0F19',
          800: '#111827',
          700: '#1F2937',
          600: '#374151',
          500: '#6B7280',
        },
        primary: {
          500: '#3B82F6',
          400: '#60A5FA',
          glow: 'rgba(59, 130, 246, 0.5)'
        },
        accent: {
          500: '#8B5CF6',
          400: '#A78BFA',
        },
        danger: {
          500: '#EF4444',
          400: '#F87171',
          glow: 'rgba(239, 68, 68, 0.4)'
        },
        warning: {
          500: '#F59E0B',
          400: '#FBBF24',
        },
        success: {
          500: '#10B981',
          400: '#34D399',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'glow-pulse': 'glowPulse 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)' },
          '50%': { boxShadow: '0 0 25px rgba(239, 68, 68, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
