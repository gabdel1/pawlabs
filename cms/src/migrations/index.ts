import * as migration_20260312_235552_add_verdicts_collection from './20260312_235552_add_verdicts_collection';

export const migrations = [
  {
    up: migration_20260312_235552_add_verdicts_collection.up,
    down: migration_20260312_235552_add_verdicts_collection.down,
    name: '20260312_235552_add_verdicts_collection'
  },
];
