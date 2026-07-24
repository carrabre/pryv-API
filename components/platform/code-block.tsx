type CodeBlockProps = {
  code: string
  label?: string
}

export function CodeBlock({code, label}: CodeBlockProps) {
  return (
    <div className='p-code'>
      {label ? <p className='p-code-label'>{label}</p> : null}
      <pre className='p-code-pre'>
        <code>{code}</code>
      </pre>
    </div>
  )
}
