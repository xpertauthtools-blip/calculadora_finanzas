/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                brand: {
                    50: '#f0f4ff',
                    100: '#dde6ff',
                    200: '#c0ceff',
                    300: '#93abff',
                    400: '#6381ff',
                    500: '#3d57ff',
                    600: '#2433f5',
                    700: '#1c26d9',
                    800: '#1a22ae',
                    900: '#1b2489',
                    950: '#111452',
                },
                surface: {
                    900: '#0a0d1a',
                    800: '#0f1325',
                    700: '#151b35',
                    600: '#1e2747',
                    500: '#2a3560',
                },
            },
        },
    },
    plugins: [],
}
