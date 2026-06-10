/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' genera un mini-servidor portable en .next/standalone
  // que es el que Electron arranca en producción.
  // Necesario porque las API routes NO funcionan con `next export`.
  output: 'standalone',
};

export default nextConfig;
