import React, { Suspense, useState, useEffect } from 'react';
import { graphql, useQueryLoader, usePreloadedQuery } from 'react-relay';
import FilterBar from '../components/FilterBar';
import StructureList from '../components/StructureList';
import StructureDetailPanel from '../components/StructureDetailPanel';

// Root query — spreads StructureList_query so the data returned by
// usePreloadedQuery serves as the fragment ref for usePaginationFragment.
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

function StructureListContainer({ queryRef, onSelectStructure }) {
  const data = usePreloadedQuery(StructuresQuery, queryRef);
  return <StructureList structures={data} onSelectStructure={onSelectStructure} />;
}

export default function StructuresPage() {
  const [queryRef, loadQuery] = useQueryLoader(StructuresQuery);
  const [selectedStructureId, setSelectedStructureId] = useState(null);

  // Issue the default query on first mount (empty filter, first 10 results)
  useEffect(() => {
    loadQuery({ filter: '', first: 10 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFilterChange(filter) {
    // Re-issue from the first page every time the filter changes.
    loadQuery({ filter, first: 10 }, { fetchPolicy: 'network-only' });
  }

  return (
    <div className="space-y-6">
      <FilterBar onFilterChange={handleFilterChange} />
      <ErrorBoundary>
        {queryRef && (
          <Suspense
            fallback={
              <div className="text-center text-gray-400 py-16 text-sm">
                Loading structures…
              </div>
            }
          >
            <StructureListContainer
              queryRef={queryRef}
              onSelectStructure={setSelectedStructureId}
            />
          </Suspense>
        )}
      </ErrorBoundary>
      <StructureDetailPanel
        structureId={selectedStructureId}
        onClose={() => setSelectedStructureId(null)}
      />
    </div>
  );
}
