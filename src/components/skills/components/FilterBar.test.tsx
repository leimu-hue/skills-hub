import { render } from '@testing-library/react'
import FilterBar from './FilterBar'

function t(key: string): string {
  return key
}

test('renders sort select outside button elements', () => {
  const { container } = render(
    <FilterBar
      sortBy="updated"
      searchQuery=""
      loading={false}
      onSortChange={() => {}}
      onSearchChange={() => {}}
      onRefresh={() => {}}
      t={t as never}
    />,
  )

  const select = container.querySelector('select') as HTMLSelectElement | null
  expect(select).not.toBeNull()
  expect(select?.closest('button')).toBeNull()
  expect(container.querySelector('button select')).toBeNull()
})
