import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export type PageModuleVariant = 'default' | 'hero' | 'data' | 'state'
export type PageModuleDensity = 'compact' | 'comfortable'
export type PageModuleTone = 'neutral' | 'danger'
export type Discipline = 'green' | 'orange' | 'pink' | 'violet' | 'blue'
export type PillButtonVariant = 'ghost' | 'primary'

type PageModuleTag = 'section' | 'article'

interface PageModuleProps extends HTMLAttributes<HTMLElement> {
  as?: PageModuleTag
  variant?: PageModuleVariant
  density?: PageModuleDensity
  tone?: PageModuleTone
}

interface ModuleHeaderProps {
  eyebrow: string
  title: string
  discipline?: Discipline
  description?: string
  action?: ReactNode
  className?: string
}

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillButtonVariant
}

interface MetricModuleProps {
  label: string
  value: ReactNode
  note: string
  className?: string
}

interface MetricGridProps extends HTMLAttributes<HTMLDivElement> {
  ariaLabel: string
}

type SegmentValue = string | number

export interface SegmentedOption<T extends SegmentValue> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends SegmentValue> {
  ariaLabel: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}

function classNames(...values: Array<string | false | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(' ')
}

export function PageModule({
  as: Tag = 'section',
  variant = 'default',
  density = 'comfortable',
  tone = 'neutral',
  className,
  children,
  ...props
}: PageModuleProps) {
  return <Tag
    {...props}
    className={classNames(
      'ui-module',
      `ui-module--${variant}`,
      `ui-module--${density}`,
      `ui-module--tone-${tone}`,
      className
    )}
  >{children}</Tag>
}

export function ModuleHeader({ eyebrow, title, discipline = 'green', description, action, className }: ModuleHeaderProps) {
  return <header className={classNames('ui-module-header', className)}>
    <div className="ui-module-header__copy">
      <p className={classNames('ui-module-header__eyebrow', `ui-module-header__eyebrow--${discipline}`)}>
        <span className="ui-module-header__bracket" aria-hidden="true">{'{'}</span>
        <span>{eyebrow}</span>
        <span className="ui-module-header__bracket" aria-hidden="true">{'}'}</span>
      </p>
      <h2 className="ui-module-header__title">{title}</h2>
      {description && <p className="ui-module-header__description">{description}</p>}
    </div>
    {action && <div className="ui-module-header__action">{action}</div>}
  </header>
}

export function PillButton({ variant = 'ghost', type = 'button', className, children, ...props }: PillButtonProps) {
  return <button
    {...props}
    type={type}
    className={classNames('ui-pill-button', `ui-pill-button--${variant}`, className)}
  >{children}</button>
}

export function ModuleDivider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr {...props} className={classNames('ui-module-divider', className)} />
}

export function MetricModule({ label, value, note, className }: MetricModuleProps) {
  return <PageModule as="article" variant="data" density="compact" className={classNames('ui-metric-module', className)}>
    <span className="ui-metric-module__label">{label}</span>
    <strong className="ui-metric-module__value">{value}</strong>
    <small className="ui-metric-module__note">{note}</small>
  </PageModule>
}

export function MetricGrid({ ariaLabel, className, children, ...props }: MetricGridProps) {
  return <div {...props} className={classNames('ui-metric-grid', className)} aria-label={ariaLabel}>{children}</div>
}

export function SegmentedControl<T extends SegmentValue>({
  ariaLabel,
  value,
  options,
  onChange,
  className
}: SegmentedControlProps<T>) {
  return <div className={classNames('ui-segmented', className)} role="group" aria-label={ariaLabel}>
    {options.map((option) => {
      const active = option.value === value
      return <button
        type="button"
        key={option.value}
        className={classNames('ui-segmented__item', active && 'ui-segmented__item--active')}
        aria-pressed={active}
        onClick={() => onChange(option.value)}
      >{option.label}</button>
    })}
  </div>
}
