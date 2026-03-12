import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import ApiKeyModal from './components/ApiKeyModal'
import { Toast } from './components/UI'

import Dashboard  from './pages/Dashboard'
import IngestPage from './pages/Ingest'
import LibraryPage from './pages/Library'
import ResearchPage from './pages/Research'
import ReviewPage  from './pages/Review'
import GraphPage   from './pages/Graph'
import AnalyticsPage from './pages/Analytics'
import SettingsPage  from './pages/Settings'

export default function App() {
  const [showApiModal, setShowApiModal] = useState(false)

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar onApiKeyClick={() => setShowApiModal(true)} />

        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg-secondary)' }}>
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/ingest"    element={<IngestPage />} />
            <Route path="/library"   element={<LibraryPage />} />
            <Route path="/research"  element={<ResearchPage />} />
            <Route path="/review"    element={<ReviewPage />} />
            <Route path="/graph"     element={<GraphPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings"  element={<SettingsPage />} />
          </Routes>
        </div>

        <ApiKeyModal open={showApiModal} onClose={() => setShowApiModal(false)} />
        <Toast />
      </div>
    </BrowserRouter>
  )
}
