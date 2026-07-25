import * as migration_20260312_235552_add_verdicts_collection from './20260312_235552_add_verdicts_collection';
import * as migration_20260314_025556 from './20260314_025556';
import * as migration_20260330_192620 from './20260330_192620';
import * as migration_20260517_120000_add_breed_comparison_to_guides from './20260517_120000_add_breed_comparison_to_guides';
import * as migration_20260725_130000_remove_products_guides_add_comparisons from './20260725_130000_remove_products_guides_add_comparisons';

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
  {
    up: migration_20260517_120000_add_breed_comparison_to_guides.up,
    down: migration_20260517_120000_add_breed_comparison_to_guides.down,
    name: '20260517_120000_add_breed_comparison_to_guides',
  },
  {
    up: migration_20260725_130000_remove_products_guides_add_comparisons.up,
    down: migration_20260725_130000_remove_products_guides_add_comparisons.down,
    name: '20260725_130000_remove_products_guides_add_comparisons',
  },
];
