const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const evidencePath = path.join(repoRoot, 'docs/acceptance-artifacts/dual-machine-regression-evidence-v031-2026-06-08.json');
const outputPath = path.join(repoRoot, 'docs/acceptance-artifacts/dual-machine-regression-evidence-verification-2026-06-08.json');

const requiredGames = ['palworld', 'minecraft_java', 'stardew_valley', 'cuphead'];
const validStatuses = new Set(['pending', 'passed', 'failed', 'needs_retest', 'blocked_external']);
const requiredIfPassed = [
  'host.machine',
  'host.os',
  'host.lan_helper_version',
  'host.game_version',
  'joiner.machine',
  'joiner.os',
  'joiner.lan_helper_version',
  'joiner.game_version',
  'route',
  'result_summary',
];

function get(obj, dotted) {
  return dotted.split('.').reduce((acc, key) => (acc && Object.prototype.hasOwnProperty.call(acc, key) ? acc[key] : undefined), obj);
}

function nonEmpty(value) {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' ? value.trim().length > 0 && !/^<.*>$/.test(value.trim()) : Boolean(value);
}

function main() {
  if (!fs.existsSync(evidencePath)) throw new Error(`Evidence file not found: ${evidencePath}`);
  const doc = JSON.parse(fs.readFileSync(evidencePath, 'utf8').replace(/^\uFEFF/, ''));
  const issues = [];
  const games = doc.games || {};

  for (const id of requiredGames) {
    const game = games[id];
    if (!game) {
      issues.push({ severity: 'error', game: id, message: 'missing game entry' });
      continue;
    }
    if (!validStatuses.has(game.status)) {
      issues.push({ severity: 'error', game: id, message: `invalid status: ${game.status}` });
    }
    if (game.status === 'passed') {
      for (const field of requiredIfPassed) {
        if (!nonEmpty(get(game, field))) {
          issues.push({ severity: 'error', game: id, message: `passed result missing required field: ${field}` });
        }
      }
      for (const field of ['evidence.screenshots', 'evidence.diagnostic_reports', 'evidence.logs']) {
        if (!nonEmpty(get(game, field))) {
          issues.push({ severity: 'error', game: id, message: `passed result missing evidence: ${field}` });
        }
      }
    }
    if (
      game.status === 'pending'
      && /已通过|验证通过|实机通过|成功加入|成功进入|\bpass(?:ed)?\b/i.test(game.result_summary || '')
    ) {
      issues.push({ severity: 'error', game: id, message: 'pending result_summary appears to claim success' });
    }
    if (!Array.isArray(game.required_evidence) || game.required_evidence.length < 4) {
      issues.push({ severity: 'warning', game: id, message: 'required_evidence should list at least four evidence types' });
    }
  }

  if (doc.release_claims?.can_claim_v1 === true) {
    issues.push({ severity: 'error', message: 'release_claims.can_claim_v1 must stay false until all required games pass' });
  }
  if (doc.release_claims?.can_claim_real_dual_machine_passed === true) {
    issues.push({ severity: 'error', message: 'release_claims.can_claim_real_dual_machine_passed must stay false until evidence is complete' });
  }

  const passedGames = requiredGames.filter((id) => games[id]?.status === 'passed');
  const summary = {
    generated_at: new Date().toISOString(),
    evidence_file: path.relative(repoRoot, evidencePath).replace(/\\/g, '/'),
    required_games: requiredGames,
    passed_games: passedGames,
    pending_or_not_passed_games: requiredGames.filter((id) => games[id]?.status !== 'passed'),
    can_claim_real_dual_machine_passed: issues.filter((i) => i.severity === 'error').length === 0 && passedGames.length === requiredGames.length,
    issues,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  if (issues.some((issue) => issue.severity === 'error')) process.exit(1);
}

main();
