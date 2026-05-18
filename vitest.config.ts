import { defineConfig } from "vitest/config";
import path from "path";

const src = path.resolve(__dirname, "./src");

export default defineConfig({
	resolve: {
		alias: {
			"#": src,
		},
	},
	test: {
		setupFiles: ["./vitest.setup.ts"],
		silent: true,
	},
});
