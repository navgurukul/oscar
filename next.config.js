/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Explicitly use SWC minifier and treat externals as ESM when possible
  swcMinify: true,
  // Expose environment variables for API routes
  env: {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    RAZORPAY_PLAN_MONTHLY: process.env.RAZORPAY_PLAN_MONTHLY,
    RAZORPAY_PLAN_YEARLY: process.env.RAZORPAY_PLAN_YEARLY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  experimental: {
    // Helps with packages that use `import.meta` and ESM-only distribution
    esmExternals: true,
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
