/** Resolve startup mode without connecting or including credentials in errors. */
export function databaseMode(databaseUrl, requestedMode = 'auto') {
  if (!['auto', 'embedded', 'external'].includes(requestedMode)) throw new Error('LOCAL_DATABASE_MODE must be auto, embedded or external');
  const match = /^mongodb(?:\+srv)?:\/\/([^/]+)\/([^?/#]+)(?:\?[^#]*)?$/.exec(databaseUrl || '');
  if (!match) throw new Error('DATABASE_URL must be a MongoDB connection string with a database name');
  const local = /^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(databaseUrl);
  // Existing .env files may still request embedded after switching to Atlas.
  // A remote URI always uses its existing database; never start a local server.
  if (!local || requestedMode === 'external') return 'external';
  const url = new URL(databaseUrl);
  if (url.searchParams.get('replicaSet') === 'rs0') return 'embedded';
  if (requestedMode === 'embedded') throw new Error('Embedded local MongoDB requires replicaSet=rs0. Use LOCAL_DATABASE_MODE=external for an existing database');
  return 'external';
}
