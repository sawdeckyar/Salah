// Metro config for use inside the Salah npm-workspaces monorepo.
// Lets Metro resolve the workspace package `@salah/core` (symlinked at the repo
// root) and watch it for changes during development.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes in packages/core hot-reload.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from both the app and the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Honor package "exports" (so @salah/core resolves to its dist build).
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
