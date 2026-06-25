import React, { Suspense, useState } from 'react';
import { graphql, useQueryLoader, usePreloadedQuery } from 'react-relay';
import FilterPanel from '../components/FilterPanel';
import StructureList from '../components/StructureList';
import { SavedStructureCard } from '../components/StructureCard';
import StructureDetailPanel from '../components/StructureDetailPanel';

const StructuresQuery = graphql`
  query StructuresQuery(
    $filter: String
    $first: Int
    $after: String
    $providers: [String!]
  ) {
    ...StructureList_query @arguments(
      filter: $filter
      first: $first
      after: $after
      providers: $providers
    )
  }
`;

class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-semibold mb-1">Failed to load structures</p>
          <p className="text-sm">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function StructureListContainer({ queryRef, onSelectStructure, savedIds, onSaveToggle }) {
  const data = usePreloadedQuery(StructuresQuery, queryRef);
  return (
    <StructureList
      structures={data}
      onSelectStructure={onSelectStructure}
      savedIds={savedIds}
      onSaveToggle={onSaveToggle}
    />
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

export default function StructuresPage() {
  const [queryRef, loadQuery] = useQueryLoader(StructuresQuery);
  const [filterString, setFilterString] = useState(null);
  const [tableExpanded, setTableExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('search');

  // Each tab tracks its own selected structure independently.
  const [searchSelectedId, setSearchSelectedId] = useState(null);
  const [savedSelectedId, setSavedSelectedId] = useState(null);

  // Saved items: Map<relayGlobalId, plainDataSnapshot>
  const [savedItems, setSavedItems] = useState(new Map());

  function handleFilterChange(filter) {
    setFilterString(filter);
    setSearchSelectedId(null);
    loadQuery({ filter, first: 10 }, { fetchPolicy: 'network-only' });
  }

  function handleReset() {
    setFilterString(null);
    setSearchSelectedId(null);
  }

  function handleSaveToggle(data) {
    const id = data.id;
    setSavedItems(prev => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Snapshot plain data so the Saved tab is independent of Relay GC.
        next.set(id, {
          id: data.id,
          provider: data.provider,
          chemicalFormulaReduced: data.chemicalFormulaReduced,
          chemicalFormulaHill: data.chemicalFormulaHill,
          elements: data.elements ? [...data.elements] : [],
          nelements: data.nelements,
          nsites: data.nsites,
          lastModified: data.lastModified,
          providerMetadata: data.providerMetadata ? { ...data.providerMetadata } : null,
        });
      }
      return next;
    });
  }

  function handleDeleteSaved(id) {
    setSavedItems(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    if (savedSelectedId === id) setSavedSelectedId(null);
  }

  // Single detail panel — driven by the active tab's selected ID.
  const currentSelectedId = activeTab === 'search' ? searchSelectedId : savedSelectedId;
  const currentOnClose = activeTab === 'search'
    ? () => setSearchSelectedId(null)
    : () => setSavedSelectedId(null);

  const savedIds = new Set(savedItems.keys());

  return (
    <div className="flex h-full">

      {/* FilterPanel column — widens when periodic table is open */}
      <div
        className={`flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto transition-all duration-200 ${
          tableExpanded ? 'w-[520px]' : 'w-80'
        }`}
      >
        <FilterPanel
          onFilterChange={handleFilterChange}
          onReset={handleReset}
          tableExpanded={tableExpanded}
          onTableExpandChange={setTableExpanded}
        />
      </div>

      {/* Results pane — tab bar + scrollable content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Tab bar */}
        <div role="tablist" className="flex border-b border-gray-200 bg-white flex-shrink-0 px-2">
          <TabButton
            label="Search"
            active={activeTab === 'search'}
            onClick={() => setActiveTab('search')}
          />
          <TabButton
            label={`Saved (${savedItems.size})`}
            active={activeTab === 'saved'}
            onClick={() => setActiveTab('saved')}
          />
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">

          {activeTab === 'search' && (
            filterString === null ? (
              <div className="flex items-center justify-center h-full min-h-48">
                <p className="text-gray-400 italic text-sm">
                  Enter filters and click Search to find structures.
                </p>
              </div>
            ) : (
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div className="text-center text-gray-400 py-16 text-sm">
                      Loading structures…
                    </div>
                  }
                >
                  {queryRef && (
                    <StructureListContainer
                      queryRef={queryRef}
                      onSelectStructure={setSearchSelectedId}
                      savedIds={savedIds}
                      onSaveToggle={handleSaveToggle}
                    />
                  )}
                </Suspense>
              </ErrorBoundary>
            )
          )}

          {activeTab === 'saved' && (
            savedItems.size === 0 ? (
              <div className="flex items-center justify-center h-full min-h-48">
                <p className="text-gray-400 italic text-sm">
                  No saved structures. Click the bookmark icon on a search result to save it.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...savedItems.entries()].map(([id, data]) => (
                  <SavedStructureCard
                    key={id}
                    structure={data}
                    onClick={() => setSavedSelectedId(id)}
                    onDelete={() => handleDeleteSaved(id)}
                  />
                ))}
              </div>
            )
          )}

        </div>
      </div>

      <StructureDetailPanel
        structureId={currentSelectedId}
        onClose={currentOnClose}
      />
    </div>
  );
}
