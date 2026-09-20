const path = require('path');

/**
 * Jest, wired the way metro.config.js wires Metro.
 *
 * The TV app lives outside the npm workspaces, so the shared caption
 * packages sit above it and resolve their own `react-native` by walking
 * up into the repo root's node_modules, where there is none. Metro
 * solves this with extraNodeModules; Jest needs the same map or it
 * cannot load the renderer at all.
 *
 * This was not a theoretical gap. `__tests__/App.test.tsx` had been
 * failing to even parse, and because the TV suite is not part of the
 * root `npm test`, nothing reported it. The app's only test was a test
 * that never ran.
 */
const appModules = path.join(__dirname, 'node_modules');
const repoRoot = path.resolve(__dirname, '..');

module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    // Exactly one React and one React Native, this app's copies, the
    // same guarantee metro.config.js makes with blockList.
    // captions-core is written for NodeNext, so its own imports carry
    // a .js extension that points at a .ts file on disk. Metro and tsc
    // both understand that; Jest's resolver takes it literally.
    '^(\.{1,2}/.*)\.js$': '$1',
    '^react$': path.join(appModules, 'react'),
    '^react-native$': path.join(appModules, 'react-native'),
    '^@everyword/captions-core$': path.join(repoRoot, 'packages', 'captions-core', 'src', 'index.ts'),
    '^karaoke-captions-react/native$': path.join(
      repoRoot, 'packages', 'karaoke-captions-react', 'src', 'native.tsx',
    ),
    // Metro resolves bundled media to a numeric asset id; Jest would try
    // to parse the MP3 as JavaScript.
    '\.(mp3|wav|m4a|aac|mp4)$': path.join(__dirname, '__mocks__', 'assetStub.js'),
  },
  transformIgnorePatterns: [
    // The shared packages ship TypeScript source, so they must be
    // transformed rather than skipped like the rest of node_modules.
    'node_modules/(?!(@react-native|react-native|@everyword|karaoke-captions-react)/)',
  ],
};
