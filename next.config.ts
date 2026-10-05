import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native / heavy Node packages out of the Next bundler.
  // Garde les paquets natifs / lourds hors du bundler Next.
  serverExternalPackages: ["better-sqlite3", "chokidar", "shiki"],
  async headers() {
    return [
      {
        // Allow same-origin iframe embeds for HomeHub widgets.
        // Autorise les iframes same-origin pour les widgets HomeHub.
        source: "/embed/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
