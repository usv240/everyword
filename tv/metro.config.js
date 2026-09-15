const fs = require('fs');
const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * The TV app lives outside the npm workspaces on purpose (React Native
 * tooling dislikes hoisted node_modules) and reaches the shared caption
 * packages through Metro: watchFolders lets Metro see them, and
 * extraNodeModules resolves their names. react and react-native are
 * pinned to this app's node_modules so there is never a duplicate React.
 *
 * Windows note: native (CMake) builds hit the 260-character MAX_PATH
 * limit under this repo's long path, so Gradle runs from a subst drive
 * (X: -> the repo). Node realpaths X: back to C:, which would put every
 * resolved file outside Metro's watch roots; watching the REAL repo root
 * (realpathSync) covers both spellings.
 */
const repoRoot = fs.realpathSync(path.resolve(__dirname, '..'));
const appRoot = fs.realpathSync(__dirname);

/**
 * Exactly one React: the shared packages sit under the repo root, whose
 * own node_modules carries the web app's React. Node-style upward
 * resolution would find that copy and crash hooks with a duplicate
 * React, so the parent copies are blocklisted (invisible to Metro) and
 * extraNodeModules routes those names to this app's node_modules.
 */
const escapeForRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blockParent = name =>
  new RegExp(
    `${escapeForRegex(path.join(repoRoot, 'node_modules', name) + path.sep)}.*`,
  );

const config = {
  watchFolders: [repoRoot],
  resolver: {
    blockList: [
      blockParent('react'),
      blockParent('react-dom'),
      blockParent('react-native'),
    ],
    extraNodeModules: {
      '@everyword/captions-core': path.join(repoRoot, 'packages', 'captions-core'),
      'karaoke-captions-react': path.join(repoRoot, 'packages', 'karaoke-captions-react'),
      react: path.join(appRoot, 'node_modules', 'react'),
      'react-native': path.join(appRoot, 'node_modules', 'react-native'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
