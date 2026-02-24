import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import LotsList from '@/pages/LotsList';
import  LotDetail from '@/pages/LotDetail';
import ManualAnalysis from '@/pages/ManualAnalysis';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lots" element={<LotsList />} />
          <Route path="/lots/:lotId" element={<LotDetail />} />
          <Route path="/analyze" element={<ManualAnalysis />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
