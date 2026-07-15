import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  MetricGrid,
  MetricModule,
  ModuleHeader,
  PageModule,
  SegmentedControl
} from '../src/renderer/src/ui'

describe('component-governed page modules', () => {
  it('renders a finite semantic surface contract', () => {
    const markup = renderToStaticMarkup(
      <PageModule as="article" variant="data" density="compact" tone="neutral" className="pilot-module">
        <ModuleHeader eyebrow="DAILY EVIDENCE" title="逐日证据" description="只展示可解释的事实" />
      </PageModule>
    )

    expect(markup).toContain('<article')
    expect(markup).toContain('ui-module--data')
    expect(markup).toContain('ui-module--compact')
    expect(markup).toContain('ui-module--tone-neutral')
    expect(markup).toContain('pilot-module')
    expect(markup).toContain('<header class="ui-module-header')
    expect(markup).toContain('ui-module-header__eyebrow')
    expect(markup).toContain('<h2 class="ui-module-header__title">逐日证据</h2>')
  })

  it('renders metric modules through a governed grid', () => {
    const markup = renderToStaticMarkup(
      <MetricGrid ariaLabel="今日指标">
        <MetricModule label="已复盘天数" value="4" note="近 7 天" />
      </MetricGrid>
    )

    expect(markup).toContain('class="ui-metric-grid"')
    expect(markup).toContain('aria-label="今日指标"')
    expect(markup).toContain('<article class="ui-module ui-module--data ui-module--compact ui-module--tone-neutral ui-metric-module">')
    expect(markup).toContain('ui-metric-module__value')
  })

  it('uses native buttons and exposes the active segmented option', () => {
    const onChange = vi.fn()
    const markup = renderToStaticMarkup(
      <SegmentedControl
        ariaLabel="规律时间范围"
        value={14}
        options={[{ value: 7, label: '近 7 天' }, { value: 14, label: '近 14 天' }]}
        onChange={onChange}
      />
    )

    expect(markup).toContain('role="group"')
    expect(markup).toContain('<button type="button"')
    expect(markup).toContain('ui-segmented__item--active')
    expect(markup).toContain('aria-pressed="true"')
  })

  it('keeps component styling token-only and migrates the pilot page', () => {
    const root = process.cwd()
    const css = readFileSync(resolve(root, 'src/renderer/src/styles/components/page-modules.css'), 'utf8')
    const cssEntry = readFileSync(resolve(root, 'src/renderer/src/styles/index.css'), 'utf8')
    const insights = readFileSync(resolve(root, 'src/renderer/src/InsightsView.tsx'), 'utf8')

    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(cssEntry).toContain("@import './components/page-modules.css'")
    expect(insights).toContain("from './ui'")
    expect(insights).not.toMatch(/className="(?:panel|panel-head|eyebrow|range-switch|insight-metrics)/)
  })
})
