import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PDFKit's font metrics are runtime assets rather than application code.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
