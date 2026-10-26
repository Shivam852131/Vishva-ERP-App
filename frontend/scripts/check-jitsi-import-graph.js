/* Walk @jitsi/react-native-sdk's static import graph (Metro-style, platform = android)
 * and report whether it reaches react-native-worklets-core (whose native module is
 * deliberately not autolinked -> TurboModuleRegistry.getEnforcing('Worklets') throws).
 *
 * Why this exists: it is the evidence behind the "Open meeting" crash fix.
 * Running it on this repo prints the chain that made importing the SDK fatal:
 *
 *   @jitsi/react-native-sdk/index.tsx
 *     -> react/features/app/actions.native.ts
 *       -> react/features/base/lib-jitsi-meet/functions.native.ts
 *         -> react-native-worklets-core/src/index.ts
 *           -> react-native-worklets-core/src/NativeWorklets.ts
 *              (getEnforcing('Worklets') at module scope)
 *
 * Because that chain is reached at *require* time, `src/jitsi/meeting.ts` only
 * imports the SDK after `TurboModuleRegistry.get('Worklets')` succeeds. Re-run
 * this after touching react-native.config.js or the Jitsi SDK version.
 *
 * Run: node scripts/check-jitsi-import-graph.js
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const nm = path.join(projectRoot, 'node_modules');
const entry = path.join(nm, '@jitsi', 'react-native-sdk', 'index.tsx');

const IMPORT_RE =
  /(?:import\s+(?:[^'"]*?from\s*)?|export\s+[^'"]*?from\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

function tryFile(base) {
  const cands = [
    base,
    `${base}.native.tsx`,
    `${base}.native.ts`,
    `${base}.native.js`,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}.json`,
    path.join(base, 'index.native.tsx'),
    path.join(base, 'index.native.ts'),
    path.join(base, 'index.native.js'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
    path.join(base, 'index.js'),
  ];
  for (const c of cands) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    } catch {}
  }
  return null;
}

function resolvePackageEntry(pkgDir) {
  // Metro honors the "react-native" / "source" / "main" fields (no "exports" here).
  let pkg = null;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
  const candidates = [pkg['react-native'], pkg.source, pkg.main].filter(Boolean);
  for (const c of candidates) {
    const hit = tryFile(path.join(pkgDir, c));
    if (hit) return hit;
  }
  return tryFile(path.join(pkgDir, 'index'));
}

function resolve(spec, fromFile) {
  let target = null;
  if (spec.startsWith('@/')) {
    target = path.resolve(projectRoot, spec.slice(2));
  } else if (spec.startsWith('.')) {
    target = path.resolve(path.dirname(fromFile), spec);
  } else if (spec.startsWith('react-native/') || spec.startsWith('@react-native/')) {
    target = path.join(nm, spec);
  } else {
    // package: only follow our two packages of interest, treat the rest as leaves
    const pkg = spec.startsWith('@')
      ? spec.split('/').slice(0, 2).join('/')
      : spec.split('/')[0];
    if (pkg === '@jitsi/react-native-sdk' || pkg === 'react-native-worklets-core') {
      if (spec === pkg) {
        const entry = resolvePackageEntry(path.join(nm, pkg));
        return entry ? { file: entry } : { unresolved: spec };
      }
      target = path.join(nm, spec);
    } else {
      return { external: pkg };
    }
  }
  const file = tryFile(target);
  return file ? { file } : { unresolved: spec };
}

const seen = new Set();
const queue = [entry];
const unresolved = [];
let workletsHit = null;
const chain = new Map();

while (queue.length) {
  const file = queue.shift();
  if (seen.has(file)) continue;
  seen.add(file);

  let src;
  try {
    src = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) {
    const spec = m[1];
    const res = resolve(spec, file);
    if (res.external) {
      if (res.external === 'react-native-worklets-core') {
        if (!workletsHit) {
          const trace = [file];
          let cur = file;
          while (chain.has(cur)) {
            cur = chain.get(cur);
            trace.unshift(cur);
          }
          workletsHit = { spec, trace };
        }
      }
      continue;
    }
    if (res.unresolved) {
      unresolved.push(`${path.relative(projectRoot, file)} -> ${spec}`);
      continue;
    }
    if (!chain.has(res.file)) chain.set(res.file, file);
    queue.push(res.file);
  }
}

console.log(`files visited: ${seen.size}`);

const workletsDir = path.join(nm, 'react-native-worklets-core') + path.sep;
const workletsFiles = [...seen].filter((f) => f.startsWith(workletsDir));
const enforcingFile = workletsFiles.find((f) =>
  f.endsWith(path.join('src', 'NativeWorklets.ts')),
);

function traceOf(file) {
  const trace = [file];
  let cur = file;
  while (chain.has(cur)) {
    cur = chain.get(cur);
    trace.unshift(cur);
  }
  return trace;
}

if (workletsFiles.length) {
  console.log('\nREACHES react-native-worklets-core: YES');
  const first = workletsFiles[0];
  console.log(
    `  files pulled in: ${workletsFiles.length} (e.g. ${path.relative(
      projectRoot,
      first,
    )})`,
  );
  console.log(
    enforcingFile
      ? `\n  *** ${path.relative(
          projectRoot,
          enforcingFile,
        )} WAS VISITED -> TurboModuleRegistry.getEnforcing('Worklets') runs at require time`
      : '\n  NativeWorklets.ts NOT visited (spec is imported but entry may differ)',
  );
  const chainStart = enforcingFile || first;
  console.log('  import chain:');
  traceOf(chainStart).forEach((f, i) =>
    console.log(`    ${'  '.repeat(i)}${path.relative(projectRoot, f)}`),
  );
} else if (workletsHit) {
  console.log('\nREACHES react-native-worklets-core: YES (as a bare external)');
  console.log(`  import: ${workletsHit.spec}`);
  console.log('  chain:');
  workletsHit.trace.forEach((f, i) =>
    console.log(`    ${'  '.repeat(i)}${path.relative(projectRoot, f)}`),
  );
} else {
  console.log('\nREACHES react-native-worklets-core: NO');
}

const uniqUnresolved = [...new Set(unresolved)];
console.log(`\nunresolved specs (${uniqUnresolved.length}):`);
uniqUnresolved.slice(0, 40).forEach((u) => console.log(`  ${u}`));
