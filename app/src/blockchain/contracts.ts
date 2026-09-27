import { parseAbi } from 'viem';
export const landAbi = parseAbi([
  'function collectionSeed() view returns (uint256)', 'function GENERATOR_VERSION() view returns (uint32)',
  'function WORLD_WIDTH() view returns (uint256)', 'function WORLD_DEPTH() view returns (uint256)', 'function PARCEL_SIZE() view returns (uint256)',
  'function ownerOf(uint256) view returns (address)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'error ERC721NonexistentToken(uint256 tokenId)',
]);
export const stateAbi = parseAbi([
  'function land() view returns (address)', 'function SCHEMA_VERSION() view returns (uint8)',
  'function getObjects(uint256 tokenId) view returns ((uint32 id,uint8 objectType,uint16 x,uint16 z,uint16 rotation)[])',
  'function placeObject(uint256 tokenId,uint8 objectType,uint16 x,uint16 z,uint16 rotation) returns (uint32)',
  'function removeObject(uint256 tokenId,uint32 objectId)',
  'event ObjectPlaced(uint256 indexed tokenId,uint32 indexed objectId,uint8 objectType,uint16 x,uint16 z,uint16 rotation,uint32 revision)',
  'event ObjectRemoved(uint256 indexed tokenId,uint32 indexed objectId,uint32 revision)',
  'error NotParcelOwner()', 'error InvalidPlacement()', 'error ParcelFull()', 'error UnknownObject()',
]);
