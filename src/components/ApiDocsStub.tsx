// Stub component to replace ApiDocs in production builds
// This prevents mock data from being bundled into production

export default function ApiDocsStub() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Not Available</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">API documentation is only available in development mode.</p>
      </div>
    </div>
  );
}
