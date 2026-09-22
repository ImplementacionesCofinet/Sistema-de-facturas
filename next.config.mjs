/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Empaqueta el servidor y solo las dependencias que usa, para poder correr
  // la app en un servidor de la empresa sin hacer npm install alli.
  output: 'standalone',
  serverExternalPackages: ['pg', 'exceljs', '@azure/storage-blob'],
  experimental: {
    serverActions: {
      // Los archivos de la DIAN y los soportes adjuntos pueden ser grandes.
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
