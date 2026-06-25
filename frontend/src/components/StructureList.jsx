import React, { useEffect, useRef } from 'react';
import { usePaginationFragment, graphql } from 'react-relay';
import StructureCard from './StructureCard';

export const StructureList_query = graphql`
  fragment StructureList_query on Query
  @refetchable(queryName: "StructureListPaginationQuery")
  @argumentDefinitions(
    filter: { type: "String" }
    first: { type: "Int", defaultValue: 10 }
    after: { type: "String" }
    providers: { type: "[String!]" }
  ) {
    structures(filter: $filter, first: $first, after: $after, providers: $providers)
    @connection(key: "StructureList_structures") {
      edges {
        node {
          id
          ...StructureCard_structure
        }
      }
    }
  }
`;

export default function StructureList({ structures, onSelectStructure, savedIds = new Set(), onSaveToggle }) {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment(
    StructureList_query,
    structures
  );
  const sentinelRef = useRef(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNext && !isLoadingNext) {
          loadNext(10);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNext, isLoadingNext, loadNext]);

  const edges = data?.structures?.edges ?? [];

  if (edges.length === 0 && !isLoadingNext) {
    return (
      <div className="text-center text-gray-400 py-16">
        No structures found for the current filter.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {edges.map(edge => (
        <StructureCard
          key={edge.node.id}
          structure={edge.node}
          onClick={() => onSelectStructure(edge.node.id)}
          isSaved={savedIds.has(edge.node.id)}
          onSaveToggle={onSaveToggle}
        />
      ))}
      {isLoadingNext && (
        <div className="text-center text-gray-400 py-4 text-sm">Loading more…</div>
      )}
      {hasNext && !isLoadingNext && (
        <div ref={sentinelRef} className="h-4" aria-hidden="true" />
      )}
    </div>
  );
}
