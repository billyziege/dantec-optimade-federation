import React from 'react';
import StructuresPage from './pages/StructuresPage';

export default function App() {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">DANTEc OPTIMADE Browser</h1>
      </header>
      <main className="flex-1 overflow-hidden">
        <StructuresPage />
      </main>
    </div>
  );
}
