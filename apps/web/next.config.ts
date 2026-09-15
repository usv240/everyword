import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@everyword/captions-core", "karaoke-captions-react"],
  // Monorepo: workspace packages live two levels up; without this Turbopack
  // roots at apps/web and refuses to compile them.
  turbopack: { root: path.join(here, "../..") },
};

export default nextConfig;
