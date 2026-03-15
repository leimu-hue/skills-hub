#!/usr/bin/env node

/**
 * Fetches popular skills from ClawHub API, resolves each skill's owner
 * via detail API, and produces featured-skills.json with GitHub source URLs.
 */

const CLAWHUB_LIST_API = 'https://clawhub.ai/api/v1/skills?sort=downloads&limit=100'
const CLAWHUB_DETAIL_API = 'https://clawhub.ai/api/v1/skills'
const GITHUB_REPO = 'openclaw/skills'
const OUTPUT_FILE = 'featured-skills.json'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'skills-hub-ci' },
    })
    if (res.status === 429 && attempt < retries) {
      const delay = 2 ** (attempt + 1) * 1000 // 2s, 4s, 8s
      console.warn(`Rate limited (429), retrying in ${delay / 1000}s... (${attempt + 1}/${retries})`)
      await sleep(delay)
      continue
    }
    if (!res.ok) throw new Error(`${url} returned ${res.status}`)
    return res.json()
  }
}

async function getOwnerHandle(slug) {
  try {
    const data = await fetchJson(`${CLAWHUB_DETAIL_API}/${encodeURIComponent(slug)}`)
    return data?.owner?.handle ?? ''
  } catch {
    return ''
  }
}

async function main() {
  console.log('Fetching skills from ClawHub API...')
  let clawSkills
  try {
    const data = await fetchJson(CLAWHUB_LIST_API)
    clawSkills = Array.isArray(data) ? data : data.items ?? data.skills ?? data.data ?? []
  } catch (err) {
    console.error('Failed to fetch ClawHub API:', err.message)
    process.exit(1)
  }
  console.log(`Got ${clawSkills.length} skills from ClawHub`)

  console.log('Resolving skill owners...')
  const skills = []
  // Process in batches of 10 for reasonable parallelism
  for (let i = 0; i < clawSkills.length; i += 10) {
    const batch = clawSkills.slice(i, i + 10)
    const results = await Promise.all(
      batch.map(async (s) => {
        const slug = s.slug ?? ''
        if (!slug) return null
        const owner = await getOwnerHandle(slug)
        const source_url = owner
          ? `https://github.com/${GITHUB_REPO}/tree/main/skills/${owner}/${slug}`
          : ''
        const stats = s.stats ?? {}
        return {
          slug,
          name: s.displayName ?? s.name ?? slug,
          summary: s.summary ?? s.description ?? '',
          downloads: stats.downloads ?? s.downloads ?? 0,
          stars: stats.stars ?? s.stars ?? 0,
          source_url,
        }
      }),
    )
    skills.push(...results.filter(Boolean))
    process.stdout.write(`  ${Math.min(i + 10, clawSkills.length)}/${clawSkills.length}\r`)
  }
  console.log('')

  const matched = skills.filter((s) => s.source_url).length
  console.log(`Matched ${matched}/${skills.length} skills to GitHub paths`)

  const output = {
    updated_at: new Date().toISOString(),
    skills,
  }

  const { writeFileSync } = await import('node:fs')
  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n')
  console.log(`Wrote ${skills.length} skills to ${OUTPUT_FILE}`)
}

main()
