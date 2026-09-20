/**
 * Stands in for a bundled media asset under Jest.
 *
 * Metro turns `require('../assets/two-pots.mp3')` into a numeric asset
 * id. Jest has no such transform and tries to parse the MP3 as
 * JavaScript, which fails on the first byte of the ID3 header. A number
 * is what the real thing resolves to, so a number is what this returns.
 */
module.exports = 1;
