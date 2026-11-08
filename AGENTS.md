# TravelMemory / 拾途

## Source repository

- The canonical source repository is `https://github.com/Da1suKE66/TravelMemory`.
- The local project is this directory, `shitu-travel`; do not include neighboring projects in a commit.
- Keep the Git remote `origin` pointed at `https://github.com/Da1suKE66/TravelMemory.git`.
- This GitHub repository is public. Keep private Site URLs, actual `.openai/hosting.json` identity, personal imports, backups, and credentials out of its commits and history. The public deployment template is `.openai/hosting.example.json`.
- The user requested that subsequent project updates be saved to this repository. Commit and push the changes belonging to each requested update before reporting it complete, unless the user explicitly asks for local-only or uncommitted work.
- Fetch and inspect remote changes before pushing. Preserve existing history; never force-push or overwrite other contributors' work. If a pull request is needed because of branch protections, use a feature branch and report its link.
- If Sites tooling temporarily changes Git remotes or tracking, restore and verify the GitHub `origin` after deployment.

## Implementation and checks

- This is a buildless browser application. Serve `dist/` with `npm start`; run the relevant checks with `npm test` and `node --check dist/app.js`.
- `dist/core.js` contains the portable data, money, date, duplicate and memory-selection rules; `dist/app.js` contains the browser UI and local persistence.
- Preserve the local `.openai/hosting.json` identity when deploying the current Site, but do not include it in the public GitHub source. Saving source to GitHub and deploying the Site are separate operations; use a separate private deployment checkout when a publishing helper requires a tracked hosting identity.
- Do not commit real travel photos, bills, tickets, archive backups, credentials, or browser data. Keep only the intentional fictional samples and test fixtures already in the project.
- Imported user data stays in browser IndexedDB. Do not introduce uploads or cloud synchronization without the user requesting that behavior.
