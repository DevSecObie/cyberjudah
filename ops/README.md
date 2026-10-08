# ops/

The Paperclip team that builds and maintains CyberJudah: who does what, under which rules, on what schedule, and where things stand.

| File | What it is | Who keeps it |
|---|---|---|
| `RULES.md` | The owner's twelve rules, word for word, and how the team applies them. | The owner; CeeJay edits only on the owner's word. |
| `TEAM.md` | The org chart: every seat's role, reporting line, model tier (the only place a model name appears), schedule, budget, write scope and "never" list. | CeeJay, with the owner's confirmation. |
| `RUNBOOK.md` | The daily cycle, how a change travels from issue to production, escalation paths, spending, swapping the CEO seat, incidents. | CeeJay and the CEO. |
| `STATE.md` | The roadmap, decisions with dates, waiting on the owner, blocked, next actions, standing approvals. | The CEO, at the end of every cycle. |
| `RUNNER.md` | The agents' own runner: how to run browser tests on it, the settings they need, the limits every seat shares, and what it cannot do. | CeeJay. |
| `SETUP.md` | The owner's one-time checklist: GitHub connection, secrets, agents, routines, switching off the old routines, repository settings. | CeeJay. |
| `RELEASES.md` | The ordered "ready to merge" list the Release manager hands the owner. Created by the Release manager's first sweep. | The Release manager. |
| `bin/ws.sh` | One copy of each repository on the agents' host: shared clones, cleanup, the nightly disk sweep (`RUNNER.md` §6). | CeeJay. |
| `agents/<role>/AGENTS.md` | The full working instructions each seat reads at every start. One per seat; the two Timeline researchers share one. | CeeJay, with the CEO. |

Nothing in this folder is product code or content. Changing it is a PR like any other; the owner merges.

