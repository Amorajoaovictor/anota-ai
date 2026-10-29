import App from '../../App'
import { initialState } from '../../domain'

export default function ImpeccablePreviewPage() {
  return <App
    initialState={initialState}
    user={{ id: 'impeccable-preview', name: 'João Neri', email: 'ux.review.20260805@example.com' }}
  />
}
