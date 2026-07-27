import { SignInForm } from './SignInForm'

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <p className="auth-eyebrow">Central de Projetos</p>
        <h1 id="sign-in-title">Entrar</h1>
        <p className="auth-description">Use e-mail e senha para acessar seus projetos.</p>
        <SignInForm />
      </section>
    </main>
  )
}
