/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Required for SharedArrayBuffer (WASM multi-threading)
  /* async headers() {
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
  }, */
  // Exclude ONNX from webpack bundling (it loads WASM dynamically)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };

      // Externalize onnxruntime-node to prevent webpack from bundling it
      // Map web/common to global variables loaded via CDN in layout.tsx
      if (!config.externals) {
        config.externals = [];
      }

      if (Array.isArray(config.externals)) {
        config.externals.push("onnxruntime-node", {
          "onnxruntime-web": "ort",
          "onnxruntime-common": "ort",
        });
      } else {
        config.externals = [
          config.externals,
          "onnxruntime-node",
          {
            "onnxruntime-web": "ort",
            "onnxruntime-common": "ort",
          },
        ];
      }

      // Ensure .mjs in certain packages are treated as ESM so minification handles import.meta
      config.module = config.module || { rules: [] };
      config.module.rules = config.module.rules || [];
      // Remove the custom rule that was possibly causing issues with minification
    } else {
      // On server side, completely externalize onnxruntime packages
      if (!config.externals) {
        config.externals = [];
      }

      if (Array.isArray(config.externals)) {
        config.externals.push(
          "onnxruntime-node",
          "onnxruntime-common",
          "onnxruntime-web"
        );
      } else {
        config.externals = [
          config.externals,
          "onnxruntime-node",
          "onnxruntime-common",
          "onnxruntime-web",
        ];
      }
    }
    return config;
  },
};

module.exports = nextConfig;
