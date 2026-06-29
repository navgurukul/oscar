/** @type {import('next').NextConfig} */
const path = require("path");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseWs = supabaseUrl.replace(/^https/, "wss");

// Introduced Report-Only: this logs violations without blocking requests, so it
// can be validated against real traffic (Razorpay checkout, the ONNX CDN script,
// Supabase REST + realtime) and then promoted to an enforcing
// `Content-Security-Policy` header. Enforcing a wrong policy would break the app.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://api.razorpay.com https://lumberjack.razorpay.com https://cdn.jsdelivr.net https://us.i.posthog.com https://us-assets.i.posthog.com`,
  "frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
]
  .join("; ")
  .replace(/\s+/g, " ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Recording uses getUserMedia, so microphone must stay allowed for same-origin.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ["@oscar/shared"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // PostHog ingestion is reverse-proxied through a same-origin /ingest path so
  // ad-blockers can't drop analytics/error events. US region hosts. The PostHog
  // API breaks under Next's automatic trailing-slash redirect; this flag is
  // APP-WIDE (Next has no per-path option), which is safe here — the app has no
  // routes that rely on trailing-slash redirect behaviour.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // COOP/COEP (Cross-Origin-Opener/Embedder-Policy) are intentionally NOT set:
  // require-corp breaks cross-origin resources (Razorpay, CDN script, images).
  // They were needed for SharedArrayBuffer (WASM multi-threading) but are off.
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
          "onnxruntime-web",
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
