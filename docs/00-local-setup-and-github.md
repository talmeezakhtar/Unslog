# Local setup and pushing to GitHub

This guide gets Callback from a zip file onto your computer, running, and into your own GitHub
repository. It takes about 20 minutes. After that, [Getting started](01-getting-started.md)
connects the database, job sources and AI keys.

| Step | Result |
| --- | --- |
| 1. Install the tools | Node.js 22, Git, GitHub CLI |
| 2. Unzip and install | The project on your computer, dependencies installed |
| 3. Check it works | Types check, tests pass, dashboard opens |
| 4. First commit | Your code saved in Git on your computer |
| 5. Create the repository and push | Your code on GitHub, CI running |
| 6. Pause the daily run | No failing runs until your keys are in |
| 7. Continue setup | Supabase, Gmail, AI keys, deploy |

---

## 1. Install the tools

You need three things. Check what you already have:

```bash
node -v     # should print v22.x
git --version
gh --version
```

**Node.js 22.** The project pins version 22 in `.nvmrc`.

- macOS / Linux: install [nvm](https://github.com/nvm-sh/nvm), then run `nvm install 22` and
  `nvm use 22` inside the project folder.
- Windows: install [nvm-windows](https://github.com/coreybutler/nvm-windows), then
  `nvm install 22` and `nvm use 22`. Or install Node 22 LTS from [nodejs.org](https://nodejs.org).

**Git.** [git-scm.com/downloads](https://git-scm.com/downloads). On Windows, the installer also
gives you **Git Bash**: use it for every command in this guide.

Tell Git who you are (once per computer). Use the email on your GitHub account:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

**GitHub CLI** (`gh`). [cli.github.com](https://cli.github.com). It handles signing in to GitHub,
because GitHub no longer accepts your account password for `git push`. Sign in once:

```bash
gh auth login
```

Choose **GitHub.com → HTTPS → Yes (authenticate Git) → Login with a web browser**, and follow
the code it shows.

> Prefer clicking to typing? [GitHub Desktop](https://desktop.github.com) can do step 5 for you:
> File → Add local repository → choose the folder → Publish repository (tick "Keep this code
> private"). Do the other steps as written.

## 2. Unzip and install

1. Unzip `callback.zip` somewhere you keep code, for example `~/projects/callback` (Windows:
   `C:\Users\<you>\projects\callback`). Avoid folders synced by OneDrive or iCloud: they slow
   `npm install` down and can lock files.
2. Open a terminal in that folder:

```bash
cd ~/projects/callback
npm install
```

This installs packages for both parts of the project (`pipeline/` and `web/`, which are npm
workspaces) and creates **`package-lock.json`**. Keep that file: you'll commit it, so GitHub
installs exactly the same versions.

Then create your local settings file:

```bash
cp .env.example .env
```

Leave it mostly empty for now. `.env` holds your secrets and is listed in `.gitignore`, so Git
never uploads it.

## 3. Check it works

```bash
npm run typecheck   # TypeScript checks both the pipeline and the dashboard
npm test            # the pipeline's unit tests
npm run build       # builds the dashboard
npm run dev         # starts the dashboard
```

- `npm test` should end with `# fail 0`. The end-to-end database tests only run when
  `TEST_DATABASE_URL` points at a local Postgres; without it they're skipped. That's fine:
  GitHub runs them for you (step 5), and [Testing](09-testing.md) shows how to run them locally.
- `npm run dev` opens the dashboard on <http://localhost:5173>. Until Supabase is connected it
  shows **"Supabase isn't connected yet"**, which means it's working. Stop it with `Ctrl+C`.

## 4. Make the first commit

```bash
git init
git status
```

**Look at the `git status` list before going on.** It must **not** show `.env` or any
`node_modules/` folder. If it does, stop: `.gitignore` is missing (it starts with a dot, so some
unzip tools hide it) and you'd upload your secrets.

Then save everything as the first commit:

```bash
git add .
git commit -m "Initial commit: Callback job-hunt copilot"
```

This is still only on your computer.

## 5. Create the GitHub repository and push

**Option A, one command** (inside the project folder):

```bash
gh repo create callback --private --source=. --remote=origin --push
```

It creates a private repository called `callback`, links it as `origin` and uploads your commit.

**Option B, on the website.**

1. Go to [github.com/new](https://github.com/new).
2. Name it `callback` and choose **Private**.
3. **Do not** tick "Add a README", ".gitignore" or "license". The project already has all three,
   and a non-empty repository makes the first push fail.
4. Click **Create repository**, copy the HTTPS address (like
   `https://github.com/<you>/callback.git`) and run:

```bash
git remote add origin https://github.com/<you>/callback.git
git push -u origin main
```

Open the repository on GitHub. You should see the README with the screenshot.

**CI starts automatically.** Open the **Actions** tab: the **CI** workflow type-checks, runs every
test against a real Postgres database and builds the dashboard. A green tick means everything
works on a clean machine.

## 6. Pause the daily run until your keys are in

The **Daily pipeline** workflow runs every morning at 08:00 Dubai time. Without your secrets it
would fail each day and email you about it. Until you finish
[Getting started step 8](01-getting-started.md#8-schedule-the-pipeline-and-deploy-the-dashboard):

Actions tab → **Daily pipeline** (left side) → **⋯** menu → **Disable workflow**.

Enable it again once the secrets are added.

## 7. Continue setup

Now follow [Getting started](01-getting-started.md) from **step 1** (Supabase). In step 2, skip
the `git clone` and `npm install` lines: you've done those. When you edit `.env`, restart
`npm run dev` so it picks up the changes.

---

## Everyday Git workflow

Small, frequent commits make a clean history to show in interviews.

```bash
git switch -c add-workable-collector   # a branch per change
# ...edit code...
npm run typecheck && npm test
git status                             # check what changed (never .env)
git add -A
git commit -m "Add Workable collector"
git push -u origin add-workable-collector
gh pr create --fill                    # open a pull request; CI checks it
```

Merge the pull request on GitHub once CI is green, then update your local copy:

```bash
git switch main
git pull
```

Working alone and want to keep it simple? Committing straight to `main` and running `git push`
is fine too. CI checks every push to `main`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `node -v` shows 18 or 20 | `nvm use 22` in the project folder (nvm reads `.nvmrc`) |
| `npm install` fails with `EACCES` / permission errors | Don't use `sudo`; install Node with nvm instead |
| `npm install` is very slow or fails with `EPERM` on Windows | Move the folder out of OneDrive, close VS Code, retry |
| `git push` asks for a password, then fails | Run `gh auth login` and choose "Authenticate Git", then push again |
| `! [rejected] main -> main (fetch first)` | The GitHub repo isn't empty (it has a README). Run `git pull --rebase origin main`, then `git push` |
| `error: src refspec main does not match any` | Nothing committed yet: do step 4 first |
| `.env` appears in `git status` | `.gitignore` is missing. Re-extract the zip with hidden files shown, and run `git rm --cached .env` if you already added it |
| You pushed a secret by mistake | Treat it as leaked: revoke and recreate that key at once (deleting the commit is not enough) |
| CI fails on GitHub but works locally | Open the failed step in the Actions tab; commit `package-lock.json` if it's missing |
| Warnings about `LF will be replaced by CRLF` (Windows) | Harmless. To silence: `git config --global core.autocrlf true` |
