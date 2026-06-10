import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Transactions from './pages/Transactions'
import SecurityCenter from './pages/SecurityCenter'
import ChatBot from './pages/ChatBot'
import MLDatasetView from './components/MLDatasetView'

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/security" element={<SecurityCenter />} />
          <Route path="/chat" element={<ChatBot />} />
          <Route path="/ml-dataset" element={<MLDatasetView />} />
        </Routes>
      </Layout>
    </Router>
  )
}
