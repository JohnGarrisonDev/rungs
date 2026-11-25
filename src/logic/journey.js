// The Journey: 60 fixed ladders in 6 chapters. Rows are [start, goal, par]; tests re-check every par.
// Stars are saved by level index, so never insert, reorder or remove rows: append a new chapter instead.
export const CHAPTERS = [
  { name: 'Ground Floor', blurb: 'Three letters. Mind the daisies.', ladders: [
    ['pan', 'pot', 2], ['cat', 'nap', 2], ['cap', 'hat', 2], ['bag', 'box', 2], ['cat', 'dog', 3],
    ['boy', 'man', 3], ['pup', 'dog', 3], ['sad', 'joy', 3], ['sun', 'sky', 3], ['bow', 'tie', 3] ] },
  { name: 'Garden Gate', blurb: 'Longer hops, then a fourth letter.', ladders: [
    ['tea', 'cup', 4], ['nap', 'bed', 4], ['dog', 'paw', 4], ['wet', 'dry', 5], ['pen', 'ink', 5],
    ['rain', 'hail', 2], ['five', 'nine', 2], ['east', 'west', 3], ['lost', 'home', 3], ['shoe', 'boot', 3] ] },
  { name: 'Treetops', blurb: 'Four letters, four or five rungs.', ladders: [
    ['cold', 'warm', 4], ['lead', 'gold', 4], ['love', 'hate', 4], ['rise', 'fall', 4], ['wood', 'fire', 4],
    ['seed', 'tree', 5], ['head', 'tail', 5], ['boat', 'ship', 5], ['wild', 'tame', 5], ['pull', 'push', 5] ] },
  { name: 'Cloud Line', blurb: 'The ladder starts to sway.', ladders: [
    ['dusk', 'dawn', 6], ['slow', 'fast', 6], ['hard', 'soft', 6], ['moon', 'star', 6], ['hide', 'seek', 6],
    ['poor', 'rich', 7], ['rain', 'snow', 7], ['four', 'five', 7], ['work', 'play', 8], ['wolf', 'lamb', 8] ] },
  { name: 'Thin Air', blurb: 'Five letters. Hold on with both claws.', ladders: [
    ['track', 'train', 3], ['shark', 'whale', 3], ['shore', 'shell', 4], ['stick', 'stone', 4], ['crane', 'plane', 4],
    ['stare', 'blink', 5], ['drive', 'brake', 5], ['brick', 'block', 5], ['flour', 'bread', 6], ['water', 'river', 6] ] },
  { name: 'Among the Stars', blurb: 'Long climbs for steady robots.', ladders: [
    ['train', 'plane', 7], ['skate', 'slide', 7], ['cream', 'sweet', 7], ['spade', 'blade', 7], ['black', 'white', 8],
    ['sleep', 'dream', 8], ['grain', 'bread', 8], ['glass', 'plate', 8], ['brown', 'black', 9], ['class', 'grade', 9] ] },
]
export const PER_CHAPTER = 10
export const JOURNEY = CHAPTERS.flatMap((c, ci) => c.ladders.map(([start, goal, par], i) => ({ start, goal, par, chapter: ci, index: ci * PER_CHAPTER + i })))
export const JOURNEY_KEYS = new Set(JOURNEY.map((l) => l.start + '>' + l.goal))
