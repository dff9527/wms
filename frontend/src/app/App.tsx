import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import { Package, Warehouse, TruckIcon, Search, BarChart3 } from 'lucide-react';
import ReceivingModule from './components/ReceivingModule';
import InventoryModule from './components/InventoryModule';
import PickingModule from './components/PickingModule';
import TraceabilityModule from './components/TraceabilityModule';
import DashboardModule from './components/DashboardModule';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="size-full bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Warehouse className="size-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">半導體 WMS 系統</h1>
              <p className="text-sm text-slate-500">Semiconductor Warehouse Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">操作員: 王小明</p>
              <p className="text-xs text-slate-500">倉庫 A | ESD 管控區</p>
            </div>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="size-full flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6">
          <TabsList className="flex gap-1">
            <TabsTrigger
              value="dashboard"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <BarChart3 className="size-4" />
              總覽
            </TabsTrigger>
            <TabsTrigger
              value="receiving"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <Package className="size-4" />
              收貨管理
            </TabsTrigger>
            <TabsTrigger
              value="inventory"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <Warehouse className="size-4" />
              庫存管理
            </TabsTrigger>
            <TabsTrigger
              value="picking"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <TruckIcon className="size-4" />
              揀貨出庫
            </TabsTrigger>
            <TabsTrigger
              value="traceability"
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 transition-colors"
            >
              <Search className="size-4" />
              追溯管理
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="dashboard" className="size-full p-0">
            <DashboardModule />
          </TabsContent>
          <TabsContent value="receiving" className="size-full p-0">
            <ReceivingModule />
          </TabsContent>
          <TabsContent value="inventory" className="size-full p-0">
            <InventoryModule />
          </TabsContent>
          <TabsContent value="picking" className="size-full p-0">
            <PickingModule />
          </TabsContent>
          <TabsContent value="traceability" className="size-full p-0">
            <TraceabilityModule />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}