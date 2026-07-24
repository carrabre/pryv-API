import {memo, type ComponentProps, type ElementType} from 'react'
import ReactMarkdown, {type Components, type ExtraProps} from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import {CodeBlock} from './code-block'
import {PiiRevealText, remarkPiiTexts} from './pii-reveal-text'
import {remarkAutoLink} from '@/lib/utils/remark-auto-link'

const components: Partial<
  Components & {
    piitext: ElementType<ComponentProps<Extract<ElementType, string>> & ExtraProps>
  }
> = {
  piitext: ({node, children, ...props}) => {
    if (node == null) throw 'Error; Check PiiTextNode, and whether data is being passed'
    const {piiPlaceholderText, piiText} = node.properties
    return (
      <PiiRevealText piiPlaceholderText={`<${piiPlaceholderText}>`}>
        {piiText as string}
      </PiiRevealText>
    )
  },
  code: CodeBlock,
  pre: ({children}) => <>{children}</>,
  ol: ({node, children, ...props}) => {
    return (
      <ol className='md-list-out' {...props}>
        {children}
      </ol>
    )
  },
  li: ({node, children, ...props}) => {
    return (
      <li className='py-1' {...props}>
        {children}
      </li>
    )
  },
  ul: ({node, children, ...props}) => {
    return (
      <ul className='md-list-out' {...props}>
        {children}
      </ul>
    )
  },
  strong: ({node, children, ...props}) => {
    return (
      <span className='font-semibold' {...props}>
        {children}
      </span>
    )
  },
  a: ({node, children, ...props}) => {
    return (
      <a className='text-blue-500 hover:underline' target='_blank' rel='noreferrer' {...props}>
        {children}
      </a>
    )
  },
  h1: ({node, children, ...props}) => {
    return (
      <h1 className='text-3xl font-semibold mt-6 mb-2' {...props}>
        {children}
      </h1>
    )
  },
  h2: ({node, children, ...props}) => {
    return (
      <h2 className='text-2xl font-semibold mt-6 mb-2' {...props}>
        {children}
      </h2>
    )
  },
  h3: ({node, children, ...props}) => {
    return (
      <h3 className='text-xl font-semibold mt-6 mb-2' {...props}>
        {children}
      </h3>
    )
  },
  h4: ({node, children, ...props}) => {
    return (
      <h4 className='text-lg font-semibold mt-6 mb-2' {...props}>
        {children}
      </h4>
    )
  },
  h5: ({node, children, ...props}) => {
    return (
      <h5 className='text-base font-semibold mt-6 mb-2' {...props}>
        {children}
      </h5>
    )
  },
  h6: ({node, children, ...props}) => {
    return (
      <h6 className='text-sm font-semibold mt-6 mb-2' {...props}>
        {children}
      </h6>
    )
  },
}

const remarkPlugins = [remarkGfm, remarkBreaks, remarkAutoLink, remarkPiiTexts]

const PureMarkdown = ({children}: {children: string}) => {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {children}
    </ReactMarkdown>
  )
}

export const Markdown = memo(
  PureMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
)
