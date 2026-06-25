import React from 'react';
import { useFragment, graphql } from 'react-relay';

export const StructureCard_structure = graphql`
  fragment StructureCard_structure on Structure {
    id
    provider
    chemicalFormulaReduced
    chemicalFormulaHill
    elements
    nelements
    nsites
    lastModified
    providerMetadata {
      __typename
      ... on NomadMetadata {
        entryId
      }
    }
  }
`;

function buildNomadUrl(entryId) {
  if (!entryId) return null;
  return `https://nomad-lab.eu/prod/v1/gui/search/entries/entry/id/${entryId}`;
}

function BookmarkIcon({ filled }) {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" aria-hidden="true">
      {filled ? (
        <path fill="currentColor" d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
      ) : (
        <path fill="none" stroke="currentColor" strokeWidth="1.5"
          d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
      )}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" className="w-4 h-4 shrink-0" aria-hidden="true" fill="currentColor">
      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

// Shared card UI — accepts plain data (no Relay dependency).
function StructureCardContent({ structure, onClick, isSaved, onSaveToggle, onDelete }) {
  const formula = structure.chemicalFormulaReduced ?? structure.chemicalFormulaHill ?? '—';
  const isNomad = structure.providerMetadata?.__typename === 'NomadMetadata';
  const nomadUrl = isNomad ? buildNomadUrl(structure.providerMetadata?.entryId) : null;
  const date = structure.lastModified
    ? new Date(structure.lastModified).toLocaleDateString()
    : null;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        {/* Save / Delete action pill — sits before the provider badge */}
        {onSaveToggle != null && (
          <button
            type="button"
            aria-label={isSaved ? 'Remove from Saved' : 'Save'}
            onClick={e => { e.stopPropagation(); onSaveToggle(); }}
            className={`group flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${
              isSaved
                ? 'bg-green-200 text-green-800 hover:bg-green-300'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            <BookmarkIcon filled={isSaved} />
            <span className="hidden group-hover:inline">
              {isSaved ? 'Remove' : 'Save'}
            </span>
          </button>
        )}
        {onDelete != null && (
          <button
            type="button"
            aria-label="Remove from Saved"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="group flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
          >
            <TrashIcon />
            <span className="hidden group-hover:inline">Remove</span>
          </button>
        )}

        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
          {structure.provider}
        </span>
        {date && <span className="text-xs text-gray-400">{date}</span>}
      </div>

      <p className="text-base font-semibold text-gray-900 truncate">{formula}</p>
      <p className="text-sm text-gray-500 mt-0.5">
        {structure.nelements} elements · {structure.nsites} sites
      </p>
      {structure.elements && structure.elements.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {structure.elements.map(el => (
            <span
              key={el}
              className="inline-block px-1.5 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
            >
              {el}
            </span>
          ))}
        </div>
      )}
      {nomadUrl && (
        <a
          href={nomadUrl}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="mt-2 inline-block text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          View in NOMAD ↗
        </a>
      )}
    </div>
  );
}

// Search-tab card: resolves data via Relay fragment, shows bookmark toggle.
export default function StructureCard({ structure: structureRef, onClick, isSaved, onSaveToggle }) {
  const structure = useFragment(StructureCard_structure, structureRef);
  return (
    <StructureCardContent
      structure={structure}
      onClick={onClick}
      isSaved={isSaved}
      onSaveToggle={onSaveToggle != null ? () => onSaveToggle(structure) : null}
    />
  );
}

// Saved-tab card: takes a plain data snapshot (no Relay fragment), shows delete button.
export function SavedStructureCard({ structure, onClick, onDelete }) {
  return (
    <StructureCardContent
      structure={structure}
      onClick={onClick}
      onDelete={onDelete}
    />
  );
}
