const { getDefaultConfig } = require('expo/metro-config');
const {
  createExplorerPhysicalEvidenceMetroMiddleware,
} = require('./scripts/explorer-physical-evidence-metro-middleware');

const config = getDefaultConfig(__dirname);
const upstreamEnhancer = config.server && config.server.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware(middleware, server) {
    const upstream = upstreamEnhancer
      ? upstreamEnhancer(middleware, server)
      : middleware;
    return createExplorerPhysicalEvidenceMetroMiddleware({
      repositoryRoot: __dirname,
      next: upstream,
    });
  },
};

module.exports = config;
