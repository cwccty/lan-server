# v0.3.1 staging manifest supervision review

Date: 2026-06-08

## Goal

Review the v0.3.1 staging helper before any `git add` is applied. The worktree contains many historical screenshots, local state files, release artifacts and preview output, so `git add .` is unsafe.

## Changes made by supervision

Updated `tools/stage_v0_3_1_candidate.ps1` to make the dry-run manifest safer:

- Expand untracked directories and evaluate individual files instead of excluding the whole directory blindly.
- Allow selected top-level `docs/acceptance-artifacts/*.json|md|txt` evidence only when names match v0.3.1 / n2n stuck / friend retest / release gate patterns.
- Exclude old `docs/V0_2_0_*` tracked docs from the v0.3.1 candidate manifest.
- Include the staging helper itself so the exact reviewed staging policy can be committed with the candidate.
- Continue excluding release ZIPs, `.lan-helper`, backups, preview output, screenshots and pid/log files.

## Dry-run result

Command:

```powershell
powershell -ExecutionPolicy Bypass -File tools\stage_v0_3_1_candidate.ps1
```

Result:

- Candidate include count: 127
- Tracked modified included: 75
- Untracked included: 52
- Excluded: 6476
- Manifest: `docs/acceptance-artifacts/v031-staging-manifest-2026-06-08.json` (full include list plus first 200 excluded-path samples; total excluded count is preserved).

## Safety checks

Checked that the include list does not contain:

- `release-artifacts/*`
- `.lan-helper/*`
- `backups/*`
- `src-tauri/target-ui-preview/*`
- screenshots (`*.png|jpg|jpeg|webp`)
- process logs / pids (`*.log|*.pid`)
- old `docs/V0_2_0_*`

Checked that the include list still contains the required n2n stuck diagnostic closure files:

- `src-tauri/src/network/n2n_backend.rs`
- `src-tauri/src/models/network.rs`
- `src/types/network.ts`
- `src/product-ui/ProductNetworkView.tsx`
- `src/product-ui/ProductDiagnosticsView.tsx`
- `src/product-ui/statusCenter.ts`
- `tools/verify_network_diagnostic_ui.cjs`
- `tools/triage_friend_retest_evidence.cjs`
- `tools/run_v0_3_1_release_gate.ps1`
- `docs/acceptance-artifacts/friend-stuck-supervision-audit-2026-06-08.md`
- `docs/acceptance-artifacts/network-diagnostic-ui-gate-2026-06-08.json`
- `docs/acceptance-artifacts/v031-release-candidate-gate-2026-06-08.json`

Result: PASS.

## Not applied yet

No staging was applied in this review. Before release:

```powershell
powershell -ExecutionPolicy Bypass -File tools\stage_v0_3_1_candidate.ps1 -Apply
git diff --cached --check
npm.cmd run release:gate:v031
```

If the release gate changes the ZIP hash, update release notes, checklist, friend retest materials and evidence before committing or publishing.
