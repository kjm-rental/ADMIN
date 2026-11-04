import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Catalog uploads allow up to 12 × 8 MiB, plus multipart form overhead.
    serverActions: { bodySizeLimit: "100mb" },
  },
  serverExternalPackages: ["tesseract.js"],
  outputFileTracingIncludes: {
    "/api/verification/**": [
      "./src/lib/document-ocr-worker.cjs",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/**/*",
    ],
    "/dashboard/verifications/**": [
      "./src/lib/document-ocr-worker.cjs",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/**/*",
    ],
  },
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/motorcycle-catalog/**",
      },
    ],
  },
};

export default nextConfig;
