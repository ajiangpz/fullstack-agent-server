# Project instructions

## Git commit conventions

- Follow the rules in `commitlint.config.mjs`.
- Before drafting a commit message, inspect recent history with
  `git log -10 --pretty=format:"%s%n%b"` and match the repository's language and
  body style.
- Use a Conventional Commits title: `<type>: <Chinese summary>`.
- Use one of the commit types allowed by the commitlint `type-enum` rule.
- Keep the title within 72 characters.
- For feature and bug-fix commits with meaningful context, use this body:

  ```text
  【修改原因】
  说明为什么需要本次修改。

  【修改内容】
  1、说明主要修改。
  2、说明关键行为、迁移、兼容处理或测试。
  ```

- Do not invent product names, module names, bug IDs, reviewers, validation
  results, or other metadata that is not present in the repository or task
  context.
- Before committing, inspect `git status --short`, `git diff --cached`, and
  `git diff --cached --check`.
- Only commit files related to the current task.
- Show the complete proposed commit message and obtain user confirmation before
  running `git commit`.
- After committing, report the commit hash and whether the worktree is clean.
