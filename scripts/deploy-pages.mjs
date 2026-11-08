/**
 * Publish `dist/` to GitHub Pages using only the REST API.
 *
 * Strategy: commit the built files to a `gh-pages` branch through the Git data API
 * (blobs → tree → commit → ref), add a `.nojekyll` marker, then point the repository's
 * Pages site at that branch. No local git remote juggling, no Actions runner required.
 *
 * Env: GITHUB_TOKEN (repo scope). Optional: GH_OWNER, GH_REPO, GH_BRANCH.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const OWNER = process.env.GH_OWNER || 'iiiiiiiiiiiiiKK';
const REPO = process.env.GH_REPO || 'sound-atlas';
const BRANCH = process.env.GH_BRANCH || 'gh-pages';
const TOKEN = process.env.GITHUB_TOKEN;
const DIST = resolve(process.cwd(), 'dist');
const API = 'https://api.github.com';

if (!TOKEN) {
  console.error('GITHUB_TOKEN is required.');
  process.exit(1);
}

const headers = {
  Authorization: `token ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'sound-atlas-deploy',
  'Content-Type': 'application/json',
};

async function call(path, init = {}, { allow404 = false } = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (response.status === 404 && allow404) return null;
  if (!response.ok) {
    const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    throw new Error(`${init.method || 'GET'} ${path} → ${response.status}: ${detail}`);
  }
  return parsed;
}

async function collect(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collect(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function main() {
  await stat(join(DIST, 'index.html'));

  const repo = await call(`/repos/${OWNER}/${REPO}`);
  console.log(`Repository: ${repo.full_name} (default branch ${repo.default_branch})`);

  // 1. Create a blob per built file, plus an empty .nojekyll.
  const files = await collect(DIST);
  console.log(`Preparing ${files.length} files from dist/…`);
  const entries = [];
  for (const file of files) {
    const bytes = await readFile(file);
    const blob = await call(`/repos/${OWNER}/${REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: bytes.toString('base64'), encoding: 'base64' }),
    });
    entries.push({
      path: relative(DIST, file).split('\\').join('/'),
      mode: '100644',
      type: 'blob',
      sha: blob.sha,
    });
  }
  entries.push({ path: '.nojekyll', mode: '100644', type: 'blob', sha: (await call(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: '', encoding: 'utf-8' }),
  })).sha });

  // 2. Build a tree. An empty tree keeps the branch history clean (no stale assets).
  const tree = await call(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ tree: entries }),
  });
  console.log(`Tree ${tree.sha} created.`);

  // 3. Commit it.
  const commit = await call(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: `Deploy Sound Atlas ${new Date().toISOString()}`,
      tree: tree.sha,
      parents: [],
    }),
  });
  console.log(`Commit ${commit.sha} created.`);

  // 4. Point the branch at it, creating the ref the first time.
  const refPath = `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`;
  const existing = await call(refPath, {}, { allow404: true });
  if (existing) {
    await call(refPath, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: true }),
    });
    console.log(`Branch ${BRANCH} moved to ${commit.sha}.`);
  } else {
    await call(`/repos/${OWNER}/${REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: commit.sha }),
    });
    console.log(`Branch ${BRANCH} created at ${commit.sha}.`);
  }

  // 5. Point Pages at the branch.
  const pages = await call(`/repos/${OWNER}/${REPO}/pages`, {}, { allow404: true });
  if (!pages) {
    await call(`/repos/${OWNER}/${REPO}/pages`, {
      method: 'POST',
      body: JSON.stringify({ source: { branch: BRANCH, path: '/' } }),
    });
    console.log('Pages site created from the gh-pages branch.');
  } else if (pages.source?.branch !== BRANCH) {
    await call(`/repos/${OWNER}/${REPO}/pages`, {
      method: 'PUT',
      body: JSON.stringify({ source: { branch: BRANCH, path: '/' } }),
    });
    console.log(`Pages source switched to ${BRANCH}.`);
  } else {
    // Re-trigger a build so the new commit is picked up promptly.
    await call(`/repos/${OWNER}/${REPO}/pages/builds`, { method: 'POST' }).catch(() => undefined);
    console.log('Pages already on this branch; requested a rebuild.');
  }

  console.log(`\nSite URL: https://${OWNER.toLowerCase()}.github.io/${REPO}/`);
}

await main();
