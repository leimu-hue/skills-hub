import { getExpandedPathsForFile } from './skillDetailTree'

test('returns parent directories for nested file selection', () => {
  expect(Array.from(getExpandedPathsForFile('docs/nested/SKILL.md'))).toEqual([
    'docs',
    'docs/nested',
  ])
})

test('returns empty set for root file selection', () => {
  expect(Array.from(getExpandedPathsForFile('SKILL.md'))).toEqual([])
})
