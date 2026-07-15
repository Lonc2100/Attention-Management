import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import FloatingWidget from './FloatingWidget'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Renderer root element is missing')

const widget = new URLSearchParams(window.location.search).get('window') === 'widget'
if (widget) document.body.classList.add('widget-body')

createRoot(root).render(
  <StrictMode>
    {widget ? <FloatingWidget /> : <App />}
  </StrictMode>
)
