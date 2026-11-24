# R0 agent diagnostics before Graph workspace

2026-11-24, `experiment/main-2`. R0 is not closed. User subsequently directed immediate Graph/unified layout implementation; this record preserves observed blockers.

An isolated import of the actual Nhân Mã v7 handoff preserved source identity `2b0c3a549a069efd273809f2cc02852ed0b88d877fc724128d523529efcd54f7`. Real selected voice and measured timing were reused, not regenerated. Frozen model: `gpt-6-luna`; existing App Server read-only/no-tools policy and bounded validation retry.

Fresh initial task `ff2abc4256914aa485baf94062283a0d` FAILED after 236875ms: required Phase 1 Story Visual was not implemented in the scene. First rejected raw output SHA `1573bda8764df9301ef861162942be4337a005dbae5b78dba8f39d8119866af4`; original code retained only the first validation attempt and left a streamed/truncated preview on the second failure. No proposal was applied. Follow-up task `d8e88e771a9c4ddea71c4008820cbccb` failed after 30110ms with `Codex returned empty inspection`. Neither is uninterrupted E2E success.

Scoped fixes: retain both validation attempts and the final complete rejected proposal before terminal failure, while allowing exactly two model turns. Missing Story Visual diagnostics now name each missing Phase 1 ID and the asset/entity/state/voice-anchor reference chain needed to repair it. No creative source or approval is auto-repaired or applied.

Regression RED observed: second invalid candidate retained one attempt instead of two; required Story Visual failure omitted SV01. GREEN: 27 agent/authoring tests passed in 67.893s after the fixes. Previous independent read-only review found no important issues in two-attempt retention; deferred minor is exact-hash/turn-ID assertions beyond nonempty provenance assertions. Broader Studio suite is running after these changes; results will be recorded separately.

Local raw receipts/config/scripts: `.superpowers/sdd/2026-11-24-studio-graph-roadmap/` (`fresh-agent.json`, `fresh-agent-retry.json`, `agent-config.json`, `agent-receipts-final.log`). They contain no approval evidence. Runtime files/media are not committed.
