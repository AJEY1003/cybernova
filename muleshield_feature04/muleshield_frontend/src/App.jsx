import { useState } from 'react'
import NetworkGraph from './components/NetworkGraph'
import TransactionFlow from './components/TransactionFlow'

export default function App() {
  const [view, setView] = useState('dashboard') // 'dashboard' or 'flow'
  const [flowData, setFlowData] = useState(null)

  function handleViewFlow(data) {
    setFlowData(data)
    setView('flow')
  }

  function handleBack() {
    setView('dashboard')
    setFlowData(null)
  }

  return (
    <>
      {view === 'dashboard' && <NetworkGraph onViewFlow={handleViewFlow} />}
      {view === 'flow' && <TransactionFlow data={flowData} onBack={handleBack} />}
    </>
  )
}
