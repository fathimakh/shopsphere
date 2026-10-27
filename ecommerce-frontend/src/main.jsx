import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { injectStore } from './api/axiosInstance'
import App from './App.jsx'
import './index.css'
import { store } from './redux/store'
import { fetchCurrentUser } from './redux/thunks/authThunks'

// Give the Axios interceptors access to the token and to sessionExpired().
injectStore(store)

// Confirm a session restored from localStorage is still valid (GET /auth/me) before
// protected routes render. Skipped automatically when nobody is logged in.
store.dispatch(fetchCurrentUser())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          gutter={10}
          toastOptions={{
            duration: 3500,
            style: { borderRadius: '12px', fontSize: '14px', color: '#292524' },
            success: { iconTheme: { primary: '#1f635c', secondary: '#ffffff' } },
          }}
        />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
