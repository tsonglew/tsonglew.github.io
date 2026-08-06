/**
 * Generates subsetted LXGW WenKai woff2 files containing only the characters
 * actually used by the site.
 *
 * The @fontsource/lxgw-wenkai package ships the full CJK font (~7MB per weight),
 * which makes every page load download ~14MB of font data. Since this is a
 * static blog, we subset each weight to just the glyphs used in src/ and public/.
 *
 * Requires: python3 with fonttools + brotli
 *   macOS: python3 -m pip install --break-system-packages fonttools brotli
 *   Ubuntu CI: pip3 install --break-system-packages fonttools brotli
 *
 * Usage: npm run subset:fonts
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url)) + '/..'
const SCAN_DIRS = ['src', 'public']
const FONT_SOURCE_DIR = join(ROOT, 'node_modules/@fontsource/lxgw-wenkai/files')
const OUT_DIR = join(ROOT, 'src/assets/fonts')
const CHARS_FILE = join(ROOT, '.astro/subset-chars.txt')
const WEIGHTS = [500, 700]

const TEXT_EXTS = new Set([
  '.md', '.mdx', '.astro', '.ts', '.mts', '.tsx', '.js', '.mjs', '.cjs',
  '.json', '.css', '.html', '.svg', '.txt', '.yaml', '.yml', '.xml'
])
const SKIP_DIRS = new Set(['node_modules', '.astro', 'dist', '.git', 'fonts', 'favicon', 'images'])

// Base character sets always kept: ASCII printable, NBSP, general punctuation
// (en/em dash, quotes, ellipsis), CJK punctuation, fullwidth forms.
const baseChars = new Set([
  ...range(0x0020, 0x007e), // ASCII printable
  0x00a0,                    // no-break space
  ...range(0x2000, 0x206f),  // general punctuation
  ...range(0x3000, 0x303f),  // CJK punctuation (，。、《》【】…)
  ...range(0xff01, 0xff5e)   // fullwidth forms
])

/** All characters found in the site's text files, plus the base set. */
function collectChars() {
  const chars = new Set(baseChars)
  for (const dir of SCAN_DIRS) {
    walk(join(ROOT, dir), (file) => {
      const text = readFileSync(file, 'utf8')
      for (const ch of text) chars.add(ch.codePointAt(0))
    })
  }
  return [...chars].sort((a, b) => a - b)
}

function walk(dir, onFile) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, onFile)
    } else if (TEXT_EXTS.has(extname(entry.name).toLowerCase())) {
      onFile(full)
    }
  }
}

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

/** Run python3 -m fontTools.subset, printing the command on failure. */
function subset(src, dest, weight, charsFile) {
  const args = [
    '-m', 'fontTools.subset',
    src,
    `--output-file=${dest}`,
    '--flavor=woff2',
    `--text-file=${charsFile}`,
    '--no-hinting',
    '--layout-features=*',
    '--notdef-glyph',
    '--notdef-outline'
  ]
  try {
    execFileSync('python3', args, { stdio: 'inherit' })
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(
        '✗ python3 not found. Install python3 and fonttools:\n' +
        '    python3 -m pip install --break-system-packages fonttools brotli'
      )
    } else {
      console.error(
        `✗ fontTools.subset failed for weight ${weight}. Install fonttools:\n` +
        '    python3 -m pip install --break-system-packages fonttools brotli'
      )
    }
    process.exit(1)
  }
}

// --- main ---
if (!existsSync(FONT_SOURCE_DIR)) {
  console.error(`✗ ${FONT_SOURCE_DIR} not found. Run "npm install" first.`)
  process.exit(1)
}
mkdirSync(dirname(CHARS_FILE), { recursive: true })
mkdirSync(OUT_DIR, { recursive: true })

const chars = collectChars()
writeFileSync(CHARS_FILE, String.fromCodePoint(...chars))
console.log(`ℹ ${chars.length} unique characters collected from ${SCAN_DIRS.join(', ')}`)

const totalIn = { 500: 0, 700: 0 }
const totalOut = { 500: 0, 700: 0 }
for (const weight of WEIGHTS) {
  const srcFile = join(FONT_SOURCE_DIR, `lxgw-wenkai-latin-${weight}-normal.woff2`)
  const destFile = join(OUT_DIR, `lxgw-wenkai-${weight}.woff2`)
  if (!existsSync(srcFile)) {
    console.error(`✗ source font not found: ${srcFile}`)
    process.exit(1)
  }
  const inBytes = readFileSync(srcFile).length
  subset(srcFile, destFile, weight, CHARS_FILE)
  const outBytes = readFileSync(destFile).length
  totalIn[weight] = inBytes
  totalOut[weight] = outBytes
  console.log(
    `✓ weight ${weight}: ${formatBytes(inBytes)} → ${formatBytes(outBytes)} ` +
    `(${((1 - outBytes / inBytes) * 100).toFixed(1)}% smaller)`
  )
}

const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0)
console.log(`✓ total: ${formatBytes(sum(totalIn))} → ${formatBytes(sum(totalOut))}`)

function formatBytes(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}
