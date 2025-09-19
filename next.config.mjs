/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: "loose",
  },
  headers: async () => [
    {
      source: "/:path*",
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
  ],
  webpack: (config) => {
    if (!config.experiments) {
      config.experiments = {};
    }
    config.experiments.asyncWebAssembly = true;
    config.experiments.layers = true;
    return config;
  },
};

export default nextConfig;
