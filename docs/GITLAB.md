# Running this on GitLab

The project was built and published on GitHub (https://github.com/Hamishfrob/fpl-optimiser). Everything in the repository works on any Git host. Only two things are GitHub-specific: the daily update job (`.github/workflows/daily.yml`) and the free web hosting (GitHub Pages). `.gitlab-ci.yml` is the GitLab equivalent of both.

**Status: written but never run on GitLab.** Expect to fix a line or two the first time.

## Steps

1. Clone the GitHub repository (it is public) and push it to a new GitLab project.
2. In GitLab go to Build, Pipelines, Run pipeline. The `pages` job runs the data update and publishes the page. When it finishes, Deploy, Pages shows the address.
3. For the daily update: Build, Pipeline schedules, New schedule, set it to run daily (for example `15 6 * * *`), on the default branch.
4. Optional, to keep the permanent record of the squad in the repository: create a project access token (Settings, Access tokens) with the `write_repository` scope and the Developer role, and save it as a CI/CD variable called `PUSH_TOKEN`, masked. Without it, the page still updates daily but new data is not saved back, so `data/squad/` stops growing.

## Things to know

- GitHub keeps running its own daily job until the GitHub repository is archived or its Actions are switched off. Two jobs saving to two places is fine, they don't clash, but the GitHub page stays live at the old address.
- To follow a different team, change the number in `config.json`.
- The FPL site blocks pages from reading it directly, which is why the daily job exists and the page only reads the `data/` folder.
- Run the tests with `npm test` (Node 22 or newer). Nothing else needs installing: the solver is already in `web/vendor/`.
