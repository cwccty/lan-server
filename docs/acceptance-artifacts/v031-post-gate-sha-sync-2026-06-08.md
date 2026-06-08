# v0.3.1 post-gate SHA sync

Date: 2026-06-08

## Gate result

Command:

```powershell
npm.cmd run release:gate:v031
```

Result: PASS.

Key gate outputs:

- ZIP SHA256: `EE65491E725538DD482CCE96CD33F2A834A311A702DA6CB0691F2C5BDA9E2C96`
- EXE SHA256: `75295FDB62187E75AB4A659647530F4F4A5F4824261ACAE49AC207C226645329`
- Windows ZIP verification: PASS
- Windows ZIP launch smoke: PASS
- n2n diagnostics fixtures: PASS, 8 passed
- network stuck diagnostic UI gate: PASS
- dual machine evidence gate: PASS, but real four-game dual-machine evidence is still pending and `can_claim_real_dual_machine_passed=false`.

## SHA sync performed

Updated current v0.3.1 SHA references in:

- `tools/triage_friend_retest_evidence.cjs`
- `docs/V0_3_1_RELEASE_DRAFT.md`
- `docs/V0_3_1_RELEASE_CHECKLIST.md`
- `docs/acceptance-artifacts/dual-machine-regression-evidence-v031-2026-06-08.json`
- `docs/acceptance-artifacts/gh-release-v0.3.1-current-2026-06-08.json`
- `docs/acceptance-artifacts/v031-staging-plan-2026-06-08.md`
- `release-artifacts/v0.3.1-friend-retest-instructions.txt`
- `release-artifacts/SEND_TO_FRIENDS_v0.3.1.txt`

## Follow-up validation

Commands:

```powershell
npm.cmd run friend:retest:triage -- --self-test
npm.cmd run regression:dual-machine:verify
```

Results:

- friend retest triage self-test: PASS
- dual machine evidence verifier: PASS, with all four real games still pending
- Old SHA references were absent from the checked v0.3.1 release notes, checklist, triage script and friend retest materials.

## Release caution

Do not publish with old SHA values. If another full rebuild is run, repeat this SHA sync before commit/release.
