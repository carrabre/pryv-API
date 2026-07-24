import {memo} from 'react'
import {CrossIcon} from './icons'
import {Button} from './ui/button'
import {useArtifact} from '@/hooks/use-artifact'

function PureArtifactCloseButton() {
  const {setArtifact} = useArtifact()

  const handleClose = (event: React.MouseEvent) => {
    // Prevent event propagation to avoid conflicts with other handlers
    event.preventDefault()
    event.stopPropagation()

    setArtifact((currentArtifact) => {
      return {
        ...currentArtifact,
        isVisible: false,
        // Preserve all artifact data (documentId, title, content, etc.)
        // Only hide the artifact instead of resetting to initial state
      }
    })
  }

  return (
    <Button
      data-testid='artifact-close-button'
      variant='outline'
      className='h-fit p-3 dark:hover:bg-zinc-700 hover:bg-zinc-100 relative z-50 transition-all cursor-pointer border-2 border-muted-foreground/30 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 shadow-md hover:shadow-lg'
      onClick={handleClose}
      type='button'
      tabIndex={0}
      aria-label='Close artifact (Press ESC to close)'
      title='Close artifact (Press ESC to close)'
    >
      <CrossIcon size={20} />
    </Button>
  )
}

export const ArtifactCloseButton = memo(
  PureArtifactCloseButton,
  () => true, // Pure component with no props
)
