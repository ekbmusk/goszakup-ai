import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import LandingPage from '@/pages/LandingPage';
import Dashboard from '@/pages/Dashboard';
import LotsList from '@/pages/LotsList';
import LotDetail from '@/pages/LotDetail';
import ManualAnalysis from '@/pages/ManualAnalysis';
import PriceAnalysis from '@/pages/PriceAnalysis';
import Customers from '@/pages/Customers';
import CustomerDetail from '@/pages/CustomerDetail';
import Categories from '@/pages/Categories';
import CategoryDetail from '@/pages/CategoryDetail';
import Timeline from '@/pages/Timeline';
import NetworkGraph from '@/pages/NetworkGraph';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — no sidebar/layout */}
        <Route path="/" element={<LandingPage />} />

        {/* Main app — with sidebar layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lots" element={<LotsList />} />
          <Route path="/lots/:lotId" element={<LotDetail />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:customerBin" element={<CustomerDetail />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/categories/:categoryCode" element={<CategoryDetail />} />
          <Route path="/price-analysis" element={<PriceAnalysis />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/network" element={<NetworkGraph />} />
          <Route path="/analyze" element={<ManualAnalysis />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
