# The owner's rules

These are the owner's rules for everyone who works on CyberJudah, agents and people alike. They are copied word for word from section 1 of the handoff of 4 October 2026 and they are not negotiable. Every agent's `AGENTS.md` under `ops/agents/` links here and repeats them in short; where a short form and this file differ, this file wins.

The owner is **Obie** (GitHub: DevSecObie). "The owner" below means him.

---

1. **Never merge a PR and never approve a production deploy without the owner's explicit go-ahead in the current conversation.** An approval for one batch doesn't carry over to the next. Open PRs, keep CI green, and report.
2. **Never put a secret or API key in the client, a commit, a PR or a chat.** Keys live in Cloudflare Worker secrets, GitHub Actions secrets or environment variables.
3. **Never invent** a scripture reference, quote, date, number or source. Quote scripture word for word from the KJV (with the Apocrypha) in the repo's own data. Where the classes and the outside sources disagree, record both.
4. **The KJV with the Apocrypha is the only Bible text.** Other languages are a later, owner-approved step. API.Bible is out; ebible.org and CrossWire are allowed for catalog research only.
5. **The classes come first.** The Bishops' and Deacons' teaching takes precedence over everyone else's. Keep the classes' exact language, including strong words; never soften it.
6. **"The ring" rule.** "All of the things they were saying about Christ is the same thing they are doing to the Israelites today… keep those negative things, but use the KJV Bible and Apocrypha to combat. This is our site, not theirs."
   - Outside charges are recorded accurately, with their source, and answered from scripture. The verses the classes used come first.
7. **Outside sources** (Wikipedia and others) are allowed when cited. Ask (the in-app assistant) may only read sites on the owner's **whitelist** (KV `ask:sources`, editable by an admin).
8. **Study resources** must be ones the classes actually used, with an approved edition and licence. Approved: Strong's (CC-BY-SA, version unstated, recorded verbatim), Josephus (Whiston, the 1905 scan), the Jewish Encyclopedia (1901–06), Smith's Dictionary of the Bible (1889).
   - On hold: Easton's new bundle, Brenton's Septuagint.
   - Dropped: Webster 1828, Britannica 1911, Nave's, Matthew Henry, the Treasury of Scripture Knowledge.
   - Link only: Zondervan, Nelson's, Blue Letter Bible, Bible Hub.
9. **Credits for Ask:**
   - Charged at cost; the owner takes no profit. The balance is shown in dollars. Top-ups are $1, $5 or $20. The free model stays free.
   - **No buying from evening to evening** (from dusk, when no blue is left in the sky) on the weekly Sabbath, on the opening and closing days of the feasts, and on New Moons, by the IUIC calendar (israelunite.org/high-holy-days/calendar/). A weekly workflow checks the calendar.
10. **The Timeline's twelve-tribes chart.** Use these tribe names exactly:

    | Tribe | People |
    |---|---|
    | Judah | the so-called African Americans |
    | Benjamin | West Indians |
    | Levi | Haitians |
    | Simeon | Dominicans |
    | Zebulon | Guatemala to Panama |
    | Ephraim | Puerto Ricans |
    | Manasseh | Cubans |
    | Gad | North American Indians |
    | Reuben | Seminoles |
    | Naphtali | Argentina and Chile |
    | Asher | Colombia to Uruguay |
    | Issachar | Mexicans |

11. **Wording:**
    - In the Timeline, say "From the classes" and "Quotes and sources". Never say "the assembly's teaching" or "what the classes teach".
    - In precept passes, never write "the teacher says", "the class teaches" or "this precept".
12. **No AI model names** in commits, PRs, code or docs.

---

## How the rules are applied by the team

These are not new rules; they say how the twelve above are carried out in the Paperclip team (see `ops/RUNBOOK.md`).

- **Rule 1 in practice.** No agent has merge or deploy authority. The Release manager hands the owner an ordered "ready to merge" list; the owner merges and approves the `production` environment in GitHub Actions. The one standing exception the owner has given is for precept passes: the Precepts reviewer may merge a pass that passes every check **only while the owner's standing approval for passes is in force** (recorded in `ops/STATE.md`); if that line is absent or withdrawn, the reviewer comments and does not merge.
- **Rule 2 in practice.** Agents never see secret values except as environment variables injected by Paperclip for a run. Nothing is pasted into issues, comments, documents, PR descriptions or files. A credential that reaches an agent by mistake is proposed as a Paperclip secret and the owner is told to rotate it.
- **Rules 3, 5, 6 and 11 in practice.** Content agents (Notes writer, Precepts writer, Precepts reviewer, Timeline researchers, Class archivist) quote scripture only through the repository's own tools (`scripts/notes/lib.py` and `v.py`, `data/bible/<slug>.json`, `check.mjs`), and every PR runs the repository's checkers. Where a checker and a rule differ, stop and ask the CEO.
- **Rule 12 in practice.** Model names appear in one place only: the "Model" column of `ops/TEAM.md`. Commit messages, PR titles and bodies, code comments, notes, passes and Timeline data never carry one. Co-author trailers on commits name the Paperclip platform, not a model.
- **The host's disk.** Every seat shares one 27 GB disk. Never clone either repository on the host; use your workspace's checkout, or `bash /data/git/ws.sh clone` when you need the other one. Before ending a run, push your branch and remove anything extra you made with `bash /data/git/ws.sh done <dir>`. Work that is not pushed is not done (`ops/RUNNER.md` §6).
- **IUIC's own history.** Per the owner's direction of 3 October 2026 (recorded in `app/scripts/final-captivity/README.md`), the `israel-united-in-christ` period covers IUIC's leaders and the organization only. Outside characterisations of IUIC are not recorded anywhere on the Timeline, as events, disagreements or sources. Rule 6 governs charges against the Israelites recorded under the other periods.
