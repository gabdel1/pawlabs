import * as migration_20260312_235552_add_verdicts_collection from './20260312_235552_add_verdicts_collection';
import * as migration_20260314_025556 from './20260314_025556';
import * as migration_20260330_192620 from './20260330_192620';

export const migrations = [
  {
    up: migration_20260312_235552_add_verdicts_collection.up,
    down: migration_20260312_235552_add_verdicts_collection.down,
    name: '20260312_235552_add_verdicts_collection',
  },
  {
    up: migration_20260314_025556.up,
    down: migration_20260314_025556.down,
    name: '20260314_025556',
  },
  {
    up: migration_20260330_192620.up,
    down: migration_20260330_192620.down,
    name: '20260330_192620'
  },
];
