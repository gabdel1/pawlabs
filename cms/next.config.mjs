import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root so Next stops warning about multiple lockfiles
  // (one in repo root, one in /cms). The root /srv/pet lockfile is the source of truth.
  outputFileTracingRoot: '/srv/pet',
  // Skip type checking during build (run separately with tsc --noEmit if needed)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Turbopack moved out of experimental in Next 15
  turbopack: {},
  experimental: {
    workerThreads: false,
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
