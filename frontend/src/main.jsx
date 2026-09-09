import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.jsx'
import { clerkUserButtonAppearance } from './clerkUserButtonAppearance'
import { I18nProvider } from './i18n/I18nProvider'

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!CLERK_KEY) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is missing — add it to frontend/.env')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={CLERK_KEY}
      appearance={{
        userButton: clerkUserButtonAppearance,
        /* Same chrome when UserProfile / account UI is shown in-app */
        userProfile: { variables: clerkUserButtonAppearance.variables },
      }}
    >
      <I18nProvider>
        <App />
      </I18nProvider>
    </ClerkProvider>
  </StrictMode>,
)
