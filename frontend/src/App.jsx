import React from 'react';
import StructuresPage from './pages/StructuresPage';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">DANTEc OPTIMADE Browser</h1>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <StructuresPage />
      </main>
    </div>
  );
}
