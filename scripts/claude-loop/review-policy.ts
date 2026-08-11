import type { Finding, RoleResult } from './schemas';

export type ReviewDisposition = {
  action: 'BLOCK' | 'REMEDIATE' | 'PASS';
  actionable: Finding[];
  advisories: Finding[];
};

function syntheticFinding(result: RoleResult, source: string): Finding {
  return {
    id: `${source}-requested-remediation`,
    severity: 'major',
    message: result.summary || `${source} requested remediation without an actionable finding`,
    fix: `Resolve the ${source} remediation request and rerun independent review.`,
  };
}

export function reviewDisposition(result: RoleResult, source = 'reviewer'): ReviewDisposition {
  const advisories = result.findings.filter((f) => f.severity === 'note');
  let actionable = result.findings.filter((f) => f.severity !== 'note');

  if (result.outcome === 'BLOCKED' || result.next_action === 'BLOCKED') {
    return { action: 'BLOCK', actionable, advisories };
  }

  const explicitlyRequestsRemediation = result.outcome === 'NEEDS_REMEDIATION' || result.next_action === 'REMEDIATE';
  if (explicitlyRequestsRemediation && actionable.length === 0) {
    actionable = [syntheticFinding(result, source)];
  }
  if (explicitlyRequestsRemediation || actionable.length > 0) {
    return { action: 'REMEDIATE', actionable, advisories };
  }
  return { action: 'PASS', actionable: [], advisories };
}

export function builderRemediationFindings(result: RoleResult): Finding[] | null {
  if (result.outcome !== 'NEEDS_REMEDIATION' && result.next_action !== 'REMEDIATE') return null;
  const actionable = result.findings.filter((f) => f.severity !== 'note');
  return actionable.length ? actionable : [syntheticFinding(result, 'builder')];
}
