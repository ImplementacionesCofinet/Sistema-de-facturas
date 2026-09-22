/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pg', 'exceljs', '@azure/storage-blob'],
  experimental: {
    serverActions: {
      // Los archivos de la DIAN y los soportes adjuntos pueden ser grandes.
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
