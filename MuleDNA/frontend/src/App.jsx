import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Transactions from './pages/Transactions';
import SecurityCenter from './pages/SecurityCenter';
import Transfer from './pages/Transfer';
import ChatBot from './pages/ChatBot';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/security" element={<SecurityCenter />} />
          <Route path="/transfer" element={<Transfer />} />
          <Route path="/chat" element={<ChatBot />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
