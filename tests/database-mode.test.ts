import { describe, expect, it } from 'vitest';
// @ts-expect-error Development launcher is a plain JavaScript module.
import { databaseMode } from '../scripts/database-mode.mjs';

describe('development database selection', () => {
  const atlas = 'mongodb+srv://test-user:test-password@cluster.example.test/dpl?retryWrites=true&w=majority';
  const local = 'mongodb://127.0.0.1:27018/dpl?replicaSet=rs0';
  it.each([undefined, 'auto', 'embedded', 'external'])('uses Atlas externally with mode %s', mode => {
    expect(databaseMode(atlas, mode)).toBe('external');
  });
  it('starts the default local replica set', () => { expect(databaseMode(local)).toBe('embedded'); });
  it('respects an explicitly external local replica set', () => { expect(databaseMode(local, 'external')).toBe('external'); });
  it('supports remote replica-set seed lists', () => {
    expect(databaseMode('mongodb://first.example.test:27017,second.example.test:27017/dpl?replicaSet=main')).toBe('external');
  });
  it('rejects missing database names without exposing credentials', () => {
    expect(() => databaseMode('mongodb+srv://private-user:private-password@cluster.example.test/')).toThrow('database name');
    expect(() => databaseMode('mongodb+srv://private-user:private-password@cluster.example.test/')).not.toThrow('private-password');
  });
  it('rejects unknown modes', () => { expect(() => databaseMode(local, 'typo')).toThrow('LOCAL_DATABASE_MODE'); });
  it('requires the expected replica set for explicitly embedded local mode', () => {
    expect(() => databaseMode('mongodb://localhost:27018/dpl', 'embedded')).toThrow('replicaSet=rs0');
  });
});
