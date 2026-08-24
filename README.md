# Manta Academy actions

This repository contains reusable GitHub Actions workflows for Manta Academy.
Its Reef deployment workflow lets a repository created from `subject-template`
publish its own website to its `gh-pages` branch on every push to `main`.

No additional repository, GitHub App, or custom secret is required.

## Reef deployment workflow

[`reef-deploy.yml`](./.github/workflows/reef-deploy.yml):

1. verifies that the triggering actor has write access when the source belongs
   to an organization;
2. checks out `reef-site-template` as the build application;
3. checks out the Reef layer and the synchronization script;
4. copies the subject Markdown, assets, and tools;
5. installs and builds the site with Bun 1.4;
6. replaces the source repository's `gh-pages` branch with the generated site.

The source repository must grant workflows read and write access. GitHub Pages
must use **Deploy from a branch**, with the `gh-pages` branch and the `/` folder.

## Calling the workflow

Subject repositories normally inherit this file from `subject-template`:

```yaml
name: Deploy Reef site

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  deploy:
    uses: MEA-RUN/actions/.github/workflows/reef-deploy.yml@main
```

## `metadata.yml` contract

Remote tools are downloaded from public GitHub repositories. Local tools are
copied from the subject repository:

```yaml
tools:
  - id: match
    repository: MEA-RUN/match
    ref: main

  - id: my-tool
    path: tools/my-tool
    name: My tool
```

For a remote tool, `ref` may be a branch, tag, or commit SHA. A local tool
directory must contain at least an `index.html` file. In both cases,
`public/tools` is rebuilt from scratch during every deployment.

## Organization repositories

For repositories owned by an organization, deployment stops unless the actor
has `write`, `maintain`, or `admin` permission. Pull requests from forks cannot
publish until their changes are reviewed and merged into `main`.
