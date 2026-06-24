import { Environment, Network, RecordSource, Store } from 'relay-runtime';
import { warningsStore } from '../lib/warningsStore';

function fetchQuery(operation, variables) {
  return fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: operation.text, variables }),
  })
    .then(res => res.json())
    .then(json => {
      const warnings = json?.extensions?.warnings;
      if (Array.isArray(warnings)) {
        warnings.forEach(w => {
          console.warn('[OPTIMADE]', w);
          warningsStore.add(w);
        });
      }
      return json;
    });
}

export const RelayEnvironment = new Environment({
  network: Network.create(fetchQuery),
  store: new Store(new RecordSource()),
});
