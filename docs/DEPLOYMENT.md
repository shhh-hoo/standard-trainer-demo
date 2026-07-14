# GitHub Pages Deployment

This repository includes a deployment workflow, but this release PR does not make the repository public, change GitHub Pages settings, or claim that a live deployment exists.

## Release sequencing

1. Complete and verify the public-safety audit, including every reachable ref, branch, and tag that will become public.
2. Keep PR #3 open.
3. As a repository administrator, change repository visibility from private to public.
4. Open **Settings → Pages** and set the Pages source to **GitHub Actions**.
5. Reconfirm PR #3's head commit, CI result, mergeability, and unresolved review threads.
6. Squash merge PR #3.
7. Check the **Deploy GitHub Pages** workflow automatically triggered by the merge push to `main`.
8. If the automatic run did not start or failed because of Pages configuration timing, rerun it with `workflow_dispatch`.
9. Complete the live validation checklist below.
10. Only after the real URL passes validation, add it to the README through a separate small PR.

If repository policy requires merging before Pages can be enabled, the first push-triggered deployment may fail at Pages configuration. Treat that as an expected administrative sequencing failure, enable Pages, and rerun the workflow manually; do not describe the initial failed run as proof of an application defect.

The expected project URL is:

```text
https://shhh-hoo.github.io/standard-trainer-demo/
```

Do not add this URL to the README until the deployed application has been checked directly.

## Deployment contract

The workflow:

- runs only for pushes to `main` or manual dispatch;
- installs dependencies with `npm ci` on Node.js 24;
- runs type checking and all tests before building;
- builds with `VITE_BASE_PATH=/standard-trainer-demo/`;
- uploads only `dist/` as the Pages artifact;
- deploys through the official GitHub Pages action with minimal token permissions.

## Live validation checklist

- [ ] The expected URL loads the workbench.
- [ ] JavaScript and CSS requests return successfully, with no critical 404s.
- [ ] The browser console has no application errors.
- [ ] The canonical path submits as `VALID_PATH`.
- [ ] Changing the early N₂O₄ mole fraction identifies the first invalid step.
- [ ] Later steps display `NOT_EVALUATED`.
- [ ] Evidence JSON downloads and contains version metadata.
- [ ] The workbench remains usable at a 500 px viewport.
- [ ] A refresh reloads traces that were labeled `PERSISTED`.

Passing the build workflow proves that a Pages artifact can be produced with the project base path. It does not prove that repository visibility, Pages configuration, DNS, or the live site is correct; those remain post-merge administrative and browser-verification steps.
