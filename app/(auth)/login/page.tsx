import {LoginClient} from './login-client'

export default function Page() {
  return (
    <main className='flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground'>
      <section
        className='w-full max-w-sm rounded-md border border-border bg-background p-5 shadow-sm'
        aria-labelledby='login-heading'
      >
        <a
          href='/login'
          className='mx-auto flex w-fit items-center gap-3 rounded-md p-1'
          aria-label='Pryv API Platform'
        >
          <img src='/icon.svg' alt='' width={32} height={32} className='h-8 w-8' />
          <span className='text-lg font-semibold leading-tight font-inter-tight'>Pryv</span>
        </a>

        <h1 id='login-heading' className='mt-6 text-center text-xl font-semibold'>
          Sign in
        </h1>

        <div className='mt-5'>
          <LoginClient />
        </div>
      </section>
    </main>
  )
}
