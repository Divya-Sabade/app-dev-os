# app-dev-os

A reusable, stage-gated Claude Code workflow for turning a product idea into a production-ready app — PRD to engineering docs to specs to security to a scaffolded app. No stage begins until the previous one is approved, and no code is written before specs exist.

---

## What This Is

`app-dev-os` is a Claude Code system: a set of custom skills (slash commands) that enforce a disciplined, repeatable build process instead of ad hoc prompting. Point it at a PRD for any product and it walks through the same five stages every time, so the quality of what you ship stops depending on how good that day's prompting was.

Built for AI PMs and builders who want discipline, not vibes, when shipping with AI coding agents.

## Quickstart

1. Clone this repo.
2. 2. Open it in Claude Code.
   3. 3. Replace the example PRD with your own product idea in `docs/`.
      4. 4. Run `/engineering-planner` and approve its output, then move through each stage below in order.
        
         5. ## Folder Structure
        
         6. ```
            app-dev-os/
            ├── CLAUDE.md              # Project instructions & stage-gated workflow rules
            ├── docs/
            │   ├── design.md              # Brand design system (colors, typography, spacing, components)
            │   └── ContractIQ_PRD.md      # Example PRD (see "Worked Example" below)
            ├── skills/                # Claude Code custom skills (slash commands)
            │   ├── engineering-planner/SKILL.md    # Stage 1: PRD -> engineering docs
            │   ├── implementation-specs/SKILL.md   # Stage 2: Engineering docs -> specs + SQL
            │   ├── security-foundation/SKILL.md    # Stage 3: Specs -> security controls + RLS policies
            │   ├── frontend-setup/SKILL.md         # Stage 4: Scaffold Next.js 14 App Router project
            │   └── design-system/SKILL.md          # Applied during all frontend work
            └── contractiq-app/        # Output of running this system end-to-end (see below)
            ```

            Files under `docs/engineering/`, `docs/specs/`, `docs/security/`, and `.env.example` are generated outputs — they're created as each stage runs, not hand-written.

            ## The Build Workflow

            | Stage | Skill | Input | Output |
            |---|---|---|---|
            | 1 — Engineering Plan | `/engineering-planner` | PRD | `docs/engineering/engineering-doc.md` + `implementation-specs.md` |
            | 2 — Implementation Specs | `/implementation-specs` | Stage 1 docs | `docs/specs/*.md` + `supabase-schema.sql` + `.env.example` |
            | 3 — Security Foundation | `/security-foundation` | Stages 1-2 docs | `docs/security/security-plan.md` + `rls-policies.sql` + `src/lib/security/` |
            | 4 — Frontend Setup | `/frontend-setup` | Stages 2-3 docs | Scaffolded Next.js 14 app |
            | 5 — Feature Implementation | (manual, one feature at a time) | `docs/specs/*.md` | Feature code |

            ## Skills

            Skills live in `skills/<name>/SKILL.md` and are invoked as slash commands in Claude Code.

            **`/engineering-planner`** — Transforms a PRD into two engineering documents. Asks clarifying questions (auth strategy, DB, LLM provider, user roles) before generating anything.

            **`/implementation-specs`** — Reads the approved engineering docs and generates granular, runnable specs, one file per concern, always including `supabase-schema.sql` and `.env.example`.

            **`/security-foundation`** — Reviews all engineering and spec documents, identifies every security surface, and implements controls before any feature code is written: auth, rate limiting, prompt injection, token limits, file upload validation, RLS policies, environment variable protection.

            **`/frontend-setup`** — Scaffolds a complete Next.js 14 (App Router) project and runs the dev server.

            **`/design-system`** — Enforces the brand design system defined in `docs/design.md` on all frontend code.

            ## Key Rules

            - Never skip a stage. Each stage depends on the output of the previous one.
            - - Never proceed without user approval. Claude stops after every stage and waits.
              - - Never write code before specs exist. Implementation only starts after Stage 2 is approved.
                - - Always apply the design system when writing any frontend code.
                 
                  - ## Worked Example: ContractIQ
                 
                  - This repo includes a full worked example of the system in action, kept in so you can see exactly what each stage produces rather than just reading about it. `docs/ContractIQ_PRD.md` was the input PRD for an enterprise AI contract-review platform (NDA/MSA analysis); `docs/engineering/`, `docs/specs/`, and `docs/security/` are the real Stage 1-3 outputs; and `contractiq-app/` is the resulting scaffolded Next.js app. Treat it as a reference for what the workflow generates, not as a starting template — swap in your own PRD to build something else.
                 
                  - ## Changelog
                 
                  - See `CHANGELOG.md` for what's changed recently — each entry doubles as a running log of real builds done with this system.
                  - 
