# Incremental continuation (same task, expanded scope)

When the user asks for **more chapters** in the same conversation or slot
(e.g. Wave 0 done → "tiếp tạo §3 và §4"), the agent must **not** generate files
immediately. Task plan steps (`wave-1`, `wave-2`) only exist after plan approval.

## Detect the situation

```
task_list({ status: ["active", "paused"], bootstrap: { … } })
→ activeForSlot with existing artifacts / completed wave-0
```

Signs:
- `task_record_wave` fails: `No step "wave-N" in task`
- User request adds DAG nodes not in `plan.waves` / `plan.rows`
- `snapshot.artifactHashes` count < files on disk under `docs/srs/`

## Mandatory — offer three choices

Present explicitly (Vietnamese or English per user):

```
Bạn đang có task {taskId} (generate:srs) đang active — đã hoàn thành wave-0 (§1–§2).

Bạn muốn tiếp tục thế nào?

  A) Resume task này — mở rộng plan thêm §3, §4 → approve lại → generate
  B) Complete task hiện tại — bootstrap task mới cho §3–§4
  C) Pause task — giữ trạng thái, làm sau
```

Wait for user choice. **Default recommendation: A** when same project and continuous intent.

## Path A — Resume + extend plan (recommended)

```
1. task_resume({ taskId })
2. Re-run readiness for NEW targets only ([context-readiness.md](./context-readiness.md))
3. Clarify blocking gaps for §3/§4
4. task_update({
     plan: {
       scopeDetail: "§1–§4",
       rows: [ …existing…, …new… ],
       waves: [ { id: "wave-0", … }, { id: "wave-1", nodes: ["srs.3-use-cases"] }, … ],
       briefing: [ … ]
     }
   })
5. task_approve_plan({ taskId })   ← creates wave-1, wave-2 steps
6. GENERATE → task_record_wave per wave
7. When done: task_complete({ summary })
```

**Never** call `task_record_wave(wave-N)` before step 5.

## Path B — Complete + new task

```
1. task_complete({ taskId, summary: "§1–§2 delivered; §3–§4 deferred" })
2. task_list({ bootstrap: { …, trigger: "§3 §4" }, force: false })
3. Full gates for new task (readiness → clarify → briefing → plan)
```

## Path C — Pause

```
task_pause({ taskId, reason: "user deferred §3–§4" })
```

## Session end (always)

After delivering the last agreed wave, **propose**:

```
task_complete({ summary: "SRS §1–§4 en; artifacts: …" })
```

If user may continue later → `task_pause` instead.

If `plan.scope: "explicit"` and all `plan.rows` have artifacts → auto-suggest complete.

## Task gate checklist (every phase)

| Phase | task_update step |
|-------|------------------|
| check | `check` → done |
| clarify | `clarify` → in-progress → done |
| briefing | `briefing` → done |
| plan | `plan` → done after `task_approve_plan` |
| each wave | `task_record_wave` |
| extract / end | `extract` → done; `task_complete` |

Skipping these updates causes TASK-001 warnings and broken `task_record_wave`.
