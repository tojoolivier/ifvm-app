## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/`. No remote issue tracker in use. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.


### styles
respond in french (soit plus pedagogue)

### Design system
After every frontend modification (new component, style change, token update), run:
```bash
npx @google/design.md lint DESIGN.md
```
Fix all warnings before considering the task done.
