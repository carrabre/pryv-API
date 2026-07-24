import type {ReactNode} from 'react'

type PageHeaderProps = {
  kicker?: string
  kickerIconSrc?: string
  kickerIconAlt?: string
  title: string
  description: string
  children?: ReactNode
}

export function PageHeader({
  kicker,
  kickerIconSrc,
  kickerIconAlt = '',
  title,
  description,
  children,
}: PageHeaderProps) {
  return (
    <section className='border-b border-border pb-8 text-foreground'>
      {kicker ? (
        <p className='p-ph-k'>
          {kickerIconSrc ? (
            <img
              src={kickerIconSrc}
              alt={kickerIconAlt}
              width={16}
              height={16}
              className='h-4 w-4'
              aria-hidden={kickerIconAlt === ''}
            />
          ) : null}
          <span>{kicker}</span>
        </p>
      ) : null}
      <div className='p-ph-row'>
        <div className='max-w-3xl'>
          <h1 className='p-ph-title'>{title}</h1>
          <p className='p-ph-desc'>{description}</p>
        </div>
        {children ? <div className='p-ph-actions'>{children}</div> : null}
      </div>
    </section>
  )
}
