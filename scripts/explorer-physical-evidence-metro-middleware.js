const fs = require('node:fs');
const path = require('node:path');

const EXPLORER_PHYSICAL_EVIDENCE_ENDPOINT =
  '/__dev_e2e__/explorer-physical-evidence';
const CAMPAIGN_ID = /^explorer-nine-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RELATIVE_REFERENCE = /^[a-z0-9][a-z0-9._/-]*$/;

function isSafeRelativeReference(value) {
  return typeof value === 'string' && RELATIVE_REFERENCE.test(value) &&
    !value.startsWith('/') && !value.includes('\\') &&
    value.split('/').every((segment) =>
      segment.length > 0 && segment !== '.' && segment !== '..');
}

function resolveExplorerPhysicalEvidenceArtifact(args) {
  if (!CAMPAIGN_ID.test(args.campaignId) ||
    !isSafeRelativeReference(args.relativeReference)) {
    throw new Error('explorer_physical_evidence_reference_invalid');
  }
  const artifactsRoot = path.resolve(args.repositoryRoot, 'artifacts');
  const campaignRoot = path.resolve(artifactsRoot, args.campaignId);
  const target = path.resolve(campaignRoot, args.relativeReference);
  if (!target.startsWith(`${campaignRoot}${path.sep}`)) {
    throw new Error('explorer_physical_evidence_reference_outside_campaign');
  }
  if (!fs.existsSync(campaignRoot) || !fs.existsSync(target) ||
    !fs.statSync(target).isFile()) return null;
  const realArtifactsRoot = fs.realpathSync(artifactsRoot);
  const realCampaignRoot = fs.realpathSync(campaignRoot);
  const realTarget = fs.realpathSync(target);
  if (!realCampaignRoot.startsWith(`${realArtifactsRoot}${path.sep}`) ||
    !realTarget.startsWith(`${realCampaignRoot}${path.sep}`)) {
    throw new Error('explorer_physical_evidence_reference_outside_campaign');
  }
  return realTarget;
}

function status(response, code) {
  response.statusCode = code;
  response.setHeader('Cache-Control', 'no-store');
  response.end();
}

function createExplorerPhysicalEvidenceMetroMiddleware(args) {
  return (request, response, next) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const prefix = `${EXPLORER_PHYSICAL_EVIDENCE_ENDPOINT}/`;
    if (!requestUrl.pathname.startsWith(prefix)) {
      return args.next(request, response, next);
    }
    if (request.method !== 'GET') return status(response, 405);
    const rawSegments = requestUrl.pathname.slice(prefix.length).split('/');
    if (rawSegments.length < 2 || rawSegments.some((segment) => !segment)) {
      return status(response, 400);
    }
    let campaignId;
    let relativeReference;
    try {
      campaignId = decodeURIComponent(rawSegments[0]);
      // CFNetwork normalises encoded slashes into path separators. Preserve
      // that canonical iOS representation, then apply the same strict
      // relative-path and realpath containment validation below.
      relativeReference = rawSegments.slice(1)
        .map((segment) => decodeURIComponent(segment))
        .join('/');
    } catch {
      return status(response, 400);
    }
    let target;
    try {
      target = resolveExplorerPhysicalEvidenceArtifact({
        repositoryRoot: args.repositoryRoot,
        campaignId,
        relativeReference,
      });
    } catch {
      return status(response, 400);
    }
    if (!target) return status(response, 404);
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/octet-stream');
    return fs.createReadStream(target).pipe(response);
  };
}

module.exports = {
  EXPLORER_PHYSICAL_EVIDENCE_ENDPOINT,
  createExplorerPhysicalEvidenceMetroMiddleware,
  isSafeRelativeReference,
  resolveExplorerPhysicalEvidenceArtifact,
};
