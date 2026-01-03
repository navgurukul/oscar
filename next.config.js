/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for SharedArrayBuffer (WASM multi-threading)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
  // Exclude ONNX from webpack bundling (it loads WASM dynamically)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };

      // Ensure .mjs in certain packages are treated as ESM so minification handles import.meta
      config.module = config.module || { rules: [] };
      config.module.rules = config.module.rules || [];
      config.module.rules.push({
        test: /\.mjs$/,
        include: [/node_modules\/onnxruntime-web/, /node_modules\/stt-tts-lib/],
        type: 'javascript/esm',
      });
    }
    return config;
  },
}

module.exports = nextConfig

