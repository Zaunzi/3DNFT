import {buildItem} from './build-item.mjs';
import {items} from './item-catalog.mjs';
for(const item of items)await buildItem(item.id);
