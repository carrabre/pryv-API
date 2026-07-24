'use client'

export type LottieLoaderSize = 'sm' | 'md' | 'lg' | number

interface LottieLoaderProps {
  className?: string
  size?: LottieLoaderSize
}

const SIZE_MAP = {
  sm: 24,
  md: 48,
  lg: 64,
}

function BrandedSpinner({size, className}: {size: number; className: string}) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{width: size, height: size}}
    >
      <div
        className='absolute rounded-full border-2 border-transparent border-t-brand-blue-500 border-r-brand-blue-600 animate-spin'
        style={{width: size * 0.8, height: size * 0.8}}
      />
      <div
        className='absolute rounded-full border-2 border-transparent border-t-brand-blue-400 opacity-40 animate-spin'
        style={{
          width: size * 0.6,
          height: size * 0.6,
          animationDirection: 'reverse',
          animationDuration: '0.8s',
        }}
      />
    </div>
  )
}

export function LottieLoader({className = '', size = 'md'}: LottieLoaderProps) {
  const sizeValue = typeof size === 'number' ? size : SIZE_MAP[size]
  return <BrandedSpinner size={sizeValue} className={className} />
}
