# Master: completed reply-aware fallback

Base: PR27 merge54a1dcb. Owner Android functional acceptance7/7PASS, maximum observed move about3s; owner reports weak moves. Functional acceptance is closed; general playing strength is not verified.

## Reproduction and cause

`qa/computer/master-regressions.json` contains two constructed legal FENs, not phone recordings. At1600nodes PR27 chooses d3d5 in both and finishes only depth1:

- Queen: Qxd5 exd5 loses queen for pawn (800cp); neither rook can recapture d5. Qe3 is a safe example.
- Rook: Rxd5 exd5 loses rook for pawn (400cp); Qd1xd5 is legal but Qd8xd5 wins the queen too. Re3 is a safe example.

The existing search correctly discards partial iterations. The defect is that depth2 immediately includes two quiescence plies and may consume the whole budget before completing. The only usable iteration is then greedy depth1. Cancellation is not involved: uncancelled deterministic calls reproduce it. No changes to evaluation coefficients or delays.

Only Master now completes depth2/q0 before the existing depth2/q2 and depth3/q2 passes. Same1600node cap and yield every8nodes. `stats.iterations` logs only complete passes. Both regressions now choose b1c3: reply-aware passes finish at400/421nodes, final interrupted passes leave that exact completed result. Tests additionally examine every immediate legal reply: another queen/rook gift cannot count as success just because its UCI differs. This conservative fixture criterion is not a global static exchange evaluator.

## Evidence

- Core two tests RED on old code, GREEN after fix. Local206/206Node, validators200/51 and161/37, Python30+2+6PASS. Final full CI/browser acceptance remains required on exact remote head.
- Independent holdout8positions prepared by a separate agent who did not read engine/tests/diagnostics. Algorithm and holdout hashes were frozen before opening; both versions8/8, no tuning after opening. No measured unseen-suite advantage is claimed.
- Existing five-task/eight-seed comparison unchanged: beginner17/40, student27/40, experienced32/40, master40/40. Other three policies also return exact PR27 moves for fixed positions/seeds.
- Independent read-only review found two Important QA gaps, no confirmed production Critical/Important. Wrong-move-only safety scoring: reproduced RED using Qh7/Rd4 alternatives, fixed and GREEN. Profile test previously stopped at the first held yield: the old flow fails an active-search precondition in the actual timer fixture under Node (completed0); fixture counter validates completed callbacks (3). Browser case now releases and waits for at least3actual zero-delay search callbacks before switching. This is not a claimed browser RED run. Final browser CI must validate it.

## Performance and paired games

Three repeats per regression/engine, alternating engine order, no deliberate parallel local suites. Actual setImmediate yields. Elapsed and intervals are wall time, include GC/OS preemption and depend on host; not Android. There is **no measured speedup**; the safety pass can cost time and reduce the budget available for deeper tactical search.

|Position|Old median ms|New median ms|Old max interval ms|New max interval ms|Nodes old/new|
|---|---:|---:|---:|---:|---:|
|queen-capture-fallback|4510.37|4705.82|96.29|143.10|1600 / 1600|
|rook-capture-fallback|4742.60|5248.37|154.69|208.39|1600 / 1600|

Full raw trials: [master-performance-result.json](../qa/computer/master-performance-result.json). Broader run under concurrent local load includes an old1663ms interval outlier; retained, not hidden. New maxima in that broader run:4584ms on positions,6170ms in games,202.68ms game interval. Separate trials reached new6948.57ms/208.39ms, old5851.83ms/154.69ms. These are limits of the measurement, not a mobile latency guarantee.

Four paired games, same1600nodes, both colours, two starts (initial and e4 e5 Nf3 Nc6),24additionalplies. All cut off, no actual wins/draws. Material centipawns are for White, not Elo or final outcomes:

|Start plies|White|Black|Result|Additional plies|Material White|
|---|---|---|---|---:|---:|
|0|old|new|cutoff|24|100|
|0|new|old|cutoff|24|-100|
|4|old|new|cutoff|24|500|
|4|new|old|cutoff|24|500|

The initial-position pair favours old by a pawn in each colour. Opening pair favours White by a rook in each colour. This does not establish a general strength gain. The proven improvement is the two fallback giveaways; small selected fixtures and short games do not establish Elo or a child's win probability. General Master quality remains open.

Reproduce: `node qa/computer/compare-master.mjs`, `node qa/computer/master-performance.mjs` (run separately), `node qa/computer/compare.mjs --tasks-only`. Complete FENs, seeds, moves, nodes, times and freeze provenance: [master-comparison-result.json](../qa/computer/master-comparison-result.json), [master-levels-result.json](../qa/computer/master-levels-result.json), master-freeze.json and master-holdout.json.

## Android acceptance after separately authorized publication

1. Confirm selected Master survives reload and a saved ordinary game continues.
2. Play several ordinary moves; record any obvious piece giveaway with screenshot/move sequence. No claim all tactical mistakes are eliminated.
3. Observe maximum thinking time on the same phone (prior observed maximum about3s); report actual change, not a desktop extrapolation.
4. During thinking, open menu and change level; old work must stop without a late extra move. Switch back and resume.
5. With existing permitted profiles, switch during thinking; both games must remain separate. No new production accounts or rating changes.
6. Check the existing flight, pause, last-move highlight, speed/off options and device orientation/no extra scrolling.
7. Report functional PASS and remaining quality/performance issues separately. Physical acceptance of this candidate is OPEN.

No VPS/SQLite/production account/ranking/API changes. BookStack169 untouched; efa23bf preserved on the previous local motion branch. Stop before merge for owner permission. Curriculum is deferred until merge and physical acceptance; then verify the original ordering and existing lessons before protected/unprotected pieces, reply capture and simple exchange.
