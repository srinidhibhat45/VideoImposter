// Curated related clips. This module is server-only: pairings never ship in the client bundle.
const video = (id, title, channel, clue) => ({ id, title, channel, clue, start: 15 });
export const pairs = [
  { id: 'dinner', pack: 'food', theme: 'Something delicious', videos: [video('1-SJGQ2HLp8', 'How to Make Perfect Pizza', 'Jamie Oliver · Gennaro Contaldo', 'cheese'), video('v191Y8AUk6w', 'The 10 Millionth Subscriber Burger', 'Gordon Ramsay', 'grill')] },
  { id: 'kitchen', pack: 'food', theme: 'In the kitchen', videos: [video('UX6K-Z67vI4', 'How To Make Focaccia', 'Jamie Oliver · Gennaro Contaldo', 'bread'), video('-AAUu2L6RQo', 'Calzone Pizza with Pancetta and Mushroom', 'Jamie Oliver · Gennaro Contaldo', 'folded')] },
  { id: 'ocean', pack: 'wild', theme: 'Under the surface', videos: [video('4HGNqFdaD34', 'Sharks 101', 'National Geographic', 'ocean'), video('oSyEZAm8nb8', 'Octopuses 101', 'Nat Geo Wild', 'arms')] },
  { id: 'big-cats', pack: 'wild', theme: 'A walk on the wild side', videos: [video('OMkEVX23BdM', 'Lions 101', 'Nat Geo Wild', 'mane'), video('FK3dav4bA4s', 'Tigers 101', 'National Geographic', 'stripes')] },
  { id: 'space', pack: 'mind', theme: 'Somewhere out there', videos: [video('kOEDG3j1bjs', 'Black Holes 101', 'National Geographic', 'gravity'), video('EFO_bsg1sw8', 'Stars 101', 'National Geographic', 'light')] },
  { id: 'earth', pack: 'mind', theme: 'The ground beneath us', videos: [video('VNGUdObDoLk', 'Volcanoes 101', 'National Geographic', 'heat'), video('e7ho6z32yyo', 'Earthquakes 101', 'National Geographic', 'shake')] },
  { id: 'weather', pack: 'mind', theme: 'A change in the weather', videos: [video('aacHWoB7cmY', 'Tornadoes 101', 'National Geographic', 'wind'), video('LlXVikDkyTg', 'Hurricanes 101', 'National Geographic', 'cloud')] },
  { id: 'rick', pack: 'rewind', theme: 'A familiar feeling', videos: [video('C2xel6q0yao', 'Cry for Help', 'Rick Astley', 'help'), video('yPYZpwSpKmA', 'Together Forever', 'Rick Astley', 'dance')] },
];
export const packs = [
  { id: 'mix', name: 'A little bit of everything', short: 'The mixed bag', description: 'A shuffle of every collection. Expect the unexpected.', cover: 'mix', color: '#d7dfce', difficulty: 'A good place to start' },
  { id: 'food', name: 'Kitchen confidential', short: 'Food for thought', description: 'Deliciously similar. Suspiciously different.', cover: 'food', color: '#f1d0ad', difficulty: 'Easy to get into' },
  { id: 'wild', name: 'Wildly suspicious', short: 'Animal instincts', description: 'Nature has a pretty good poker face.', cover: 'wild', color: '#d9dfc4', difficulty: 'Trust your instincts' },
  { id: 'mind', name: 'Out of this world', short: 'Mind blown', description: 'Big ideas. Very questionable explanations.', cover: 'mind', color: '#d8d3e7', difficulty: 'A little trickier' },
  { id: 'rewind', name: 'Rewind the evidence', short: 'The throwbacks', description: 'Same artist. A different kind of déjà vu.', cover: 'rewind', color: '#eac5c6', difficulty: 'For the music lovers' },
];
export function publicPacks() { return packs.map(p => ({ ...p, count: p.id === 'mix' ? pairs.length : pairs.filter(v => v.pack === p.id).length })); }
