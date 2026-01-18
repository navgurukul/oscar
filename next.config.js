/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // For Capacitor mobile app, use server URL approach instead of static export
  // This allows API routes to work normally
  // Configure capacitor.config.ts with server.url pointing to deployed app
  // output: 'export', // Not needed with server URL approach
  // images: {
  //   unoptimized: true,
  // },
  // Expose environment variables for API routes
  env: {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  },
  // Required for SharedArrayBuffer (WASM multi-threading)
  // Note: headers() is not compatible with static export
  // These headers should be set at the server/CDN level for static export
  // async headers() {
  //   return [
  //     {
  //       source: "/(.*)",
  //       headers: [
  //         {
  //           key: "Cross-Origin-Opener-Policy",
  //           value: "same-origin",
  //         },
  //         {
  //           key: "Cross-Origin-Embedder-Policy",
  //           value: "require-corp",
  //         },
  //       ],
  //     },
  //   ];
  // },
  // Exclude ONNX from webpack bundling (it loads WASM dynamically)
  // Note: Using webpack explicitly since Turbopack doesn't support custom config yet
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };

      // Externalize onnxruntime-node to prevent webpack from bundling it
      config.externals = config.externals || [];
      config.externals.push("onnxruntime-node", "onnxruntime-common");

      // Ensure .mjs in certain packages are treated as ESM so minification handles import.meta
      config.module = config.module || { rules: [] };
      config.module.rules = config.module.rules || [];
      config.module.rules.push({
        test: /\.mjs$/,
        include: [
          /node_modules\/onnxruntime-web/,
          /node_modules\/speech-to-speech/,
        ],
        type: "javascript/esm",
      });
    } else {
      // On server side, completely externalize onnxruntime packages
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push(
          "onnxruntime-node",
          "onnxruntime-common",
          "onnxruntime-web"
        );
      }
    }
    return config;
  },
};

module.exports = nextConfig;
