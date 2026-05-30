import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // R3F v9 + React 19 Strict Mode tears down and remounts the WebGL context
  // mid-init, which surfaces as "Cannot read properties of null (reading 'alpha')".
  // Disable until R3F handles strict-mode double-mounts cleanly.
  reactStrictMode: false,
  transpilePackages: ["three"],
};

export default nextConfig;
