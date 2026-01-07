import type { NextConfig } from "next";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirnameESM = dirname(__filename);

const nextConfig: NextConfig = {
  /* config options here */

  // Optimize for Vercel deployment
  output: 'standalone',

  // Set the root directory for file tracing
  outputFileTracingRoot: __dirnameESM,
  
  // CORS headers for API routes (needed for tenant/custom domains)
  async headers() {
    return [
      {
        // Apply to all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-tenant-org-id, x-internal-request" },
        ],
      },
    ];
  },
  
  // Skip static generation errors - app requires auth
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // Configure external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'scontent-ams2-1.cdninstagram.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.clerk.dev',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.stream-io-cdn.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'getstream.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'randomuser.me',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
    ],
  },
  
  // Optimize bundle splitting for faster initial load
  experimental: {
    optimizePackageImports: ['stream-chat', 'stream-chat-react', 'lucide-react', '@clerk/nextjs', 'framer-motion'],
  },
  
  // Enable compression for faster loading
  compress: true,
  
  // Acknowledge Turbopack as default bundler in Next.js 16
  // Note: If Turbopack has race condition issues, build with: npx next build --webpack
  turbopack: {},
  
  webpack: (config, { isServer, dev }) => {
    // Only apply optimizations in development for faster rebuilds
    if (!isServer && dev) {
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false, // Disable code splitting in dev for faster builds
      };
    }
    
    // Production optimizations
    if (!isServer && !dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization?.splitChunks,
          chunks: 'all',
          cacheGroups: {
            ...config.optimization?.splitChunks?.cacheGroups,
            // Stream Chat - largest dependency
            streamChat: {
              test: /[\\/]node_modules[\\/](stream-chat|stream-chat-react)[\\/]/,
              name: 'stream-chat',
              chunks: 'async',
              priority: 20,
              enforce: true,
            },
            // React components
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 15,
            },
            // Common vendor code
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
          },
        },
      };
    }
    
    return config;
  },
};

export default nextConfig;
