import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// In dev, proxy /api/* to a real Portainer instance so the UI can run
// against a live server without CORS issues. PORTAINER_URL is configurable.
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, process.cwd(), '');
    var target = env.PORTAINER_URL || 'http://localhost:9000';
    return {
        plugins: [react()],
        server: {
            host: true,
            port: 5173,
            proxy: {
                '/api': {
                    target: target,
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
        build: {
            outDir: 'dist',
            sourcemap: false,
        },
    };
});
