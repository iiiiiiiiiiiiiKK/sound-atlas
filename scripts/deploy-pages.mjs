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

async function call(path, init = {}, { allow404 = false, retries = 4 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
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
        // A 5xx or rate limit is worth another try; a 4xx is not.
        if (response.status >= 500 || response.status === 429) {
          lastError = new Error(`${init.method || 'GET'} ${path} → ${response.status}: ${detail}`);
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(`${init.method || 'GET'} ${path} → ${response.status}: ${detail}`);
      }
      return parsed;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.includes('→ 4')) throw error;
      if (attempt === retries - 1) break;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error(`${path} failed`);
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
    try {
      await call(`/repos/${OWNER}/${REPO}/pages`, {
        method: 'POST',
        body: JSON.stringify({ source: { branch: BRANCH, path: '/' } }),
      });
      console.log('Pages site created from the gh-pages branch.');
    } catch (error) {
      // 409 means the site already exists (often created by the first push), which is fine.
      if (!String(error.message).includes('409')) throw error;
      console.log('Pages was already enabled; continuing.');
    }
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

  const final = await call(`/repos/${OWNER}/${REPO}/pages`, {}, { allow404: true });
  console.log(`\nSite URL: ${final?.html_url ?? `https://${OWNER.toLowerCase()}.github.io/${REPO}/`}`);
  console.log(`Status: ${final?.status ?? 'unknown'}`);
}

await main();
