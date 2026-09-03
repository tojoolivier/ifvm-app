import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface LoginResponse {
  access_token: string
  refresh_token: string
}

interface RegisterPayload {
  nom: string
  email: string
  password: string
}

async function login(email: string, password: string) {
  const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
  return data
}

async function register(payload: RegisterPayload) {
  const { data } = await api.post('/auth/register', payload)
  return data
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')

  const navigate = useNavigate()

  const loginMutation = useMutation({
    mutationFn: () => login(email, password),
    onSuccess: (data) => {
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      navigate('/')
    },
  })

  const registerMutation = useMutation({
    mutationFn: () => register({ nom, email, password }),
    onSuccess: () => {
      setMode('login')
      setPassword('')
      setConfirmPassword('')
      setFormError('')
    },
  })

  const isPending = loginMutation.isPending || registerMutation.isPending

  function switchMode(next: 'login' | 'register') {
    setMode(next)
    setFormError('')
    loginMutation.reset()
    registerMutation.reset()
    setPassword('')
    setConfirmPassword('')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError('')

    if (mode === 'register') {
      if (password.length < 8) {
        setFormError('Le mot de passe doit contenir au moins 8 caractères.')
        return
      }
      if (password !== confirmPassword) {
        setFormError('Les mots de passe ne correspondent pas.')
        return
      }
      registerMutation.mutate()
    } else {
      loginMutation.mutate()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EDE7D8] px-4">
      <div className="w-full max-w-[380px] bg-[#F2ECDD] border border-[#D8D0BC] rounded-xl px-8 py-9">
        <div className="w-14 h-14 rounded-full bg-[#1F4D33] flex items-center justify-center mx-auto mb-5">
          <span className="font-['Fraunces',serif] font-semibold text-[11px] tracking-wide text-[#F2ECDD]">
            IFVM
          </span>
        </div>

        <h1 className="font-['Fraunces',serif] font-semibold text-xl text-[#2B2A22] text-center mb-1">
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </h1>
        <p className="text-[13px] text-[#6B6A5C] text-center mb-6">
          {mode === 'login'
            ? 'Accédez à votre espace de suivi IFVM.'
            : 'Renseignez vos informations pour continuer.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1">
              <Label htmlFor="nom" className="text-[12px] text-[#5B5A4C]">
                Nom complet
              </Label>
              <Input
                id="nom"
                required
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                disabled={isPending}
                className="h-[38px] bg-[#FBF8F0] border-[#D8D0BC] text-[13px] focus-visible:ring-[#1F4D33]"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="email" className="text-[12px] text-[#5B5A4C]">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="nom@ifvm.mg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              className="h-[38px] bg-[#FBF8F0] border-[#D8D0BC] text-[13px] focus-visible:ring-[#1F4D33]"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-[12px] text-[#5B5A4C]">
              Mot de passe
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
                className="h-[38px] bg-[#FBF8F0] border-[#D8D0BC] text-[13px] pr-9 focus-visible:ring-[#1F4D33]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A886F] hover:text-[#5B5A4C]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-[12px] text-[#5B5A4C]">
                Confirmer le mot de passe
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
                className="h-[38px] bg-[#FBF8F0] border-[#D8D0BC] text-[13px] focus-visible:ring-[#1F4D33]"
              />
            </div>
          )}

          {(formError || loginMutation.isError || registerMutation.isError) && (
            <p className="text-[#A32D2D] text-[12px]">
              {formError ||
                (mode === 'login'
                  ? 'Email ou mot de passe incorrect.'
                  : "Une erreur est survenue lors de l'inscription.")}
            </p>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-10 bg-[#B65C28] hover:bg-[#9E4D20] text-[#FBEFE3] text-[13px] font-medium rounded-md"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </Button>

          <p className="text-center text-[12px] text-[#6B6A5C] pt-1">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="text-[#B65C28] font-medium hover:underline"
                >
                  Créer un compte
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-[#B65C28] font-medium hover:underline"
                >
                  Se connecter
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}