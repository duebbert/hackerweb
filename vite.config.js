import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				'hw-web': resolve(__dirname, 'assets/js/hw-web.js'),
				'hw-ios': resolve(__dirname, 'assets/js/hw-ios.js'),
				'hw-ios-2': resolve(__dirname, 'assets/js/hw-ios-2.js'),
			},
			output: {
				dir: 'js',
				entryFileNames: '[name].min.js',
				chunkFileNames: '[name].js',
				assetFileNames: '[name][extname]',
			},
		},
		sourcemap: true,
		minify: true,
		// Don't clear the output directory (hnapi-worker.js lives there)
		emptyOutDir: false,
	},
	// Dev server serves from project root
	root: '.',
	publicDir: false,
	server: {
		open: '/index.html',
	},
});
