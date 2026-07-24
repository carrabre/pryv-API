type BulletListProps = {
  items: readonly string[]
  className?: string
  markerClassName?: string
}

export function BulletList({
  items,
  className = 'mt-4 space-y-2 text-sm text-muted-foreground',
  markerClassName = 'd-muted-marker',
}: BulletListProps) {
  return (
    <ul className={`${className} d-bul ${markerClassName}`}>
      {items.map((item) => (
        <li key={item} className='pl-1'>
          {item}
        </li>
      ))}
    </ul>
  )
}
