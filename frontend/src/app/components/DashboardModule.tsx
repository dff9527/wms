import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Package, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function DashboardModule() {
  const statsData = [
    { title: '總庫存量', value: '125,840', unit: 'PCS', icon: Package, color: 'bg-blue-500', change: '+5.2%' },
    { title: '待收貨', value: '12', unit: '批次', icon: TrendingUp, color: 'bg-green-500', change: '+2' },
    { title: '待揀貨', value: '8', unit: '訂單', icon: AlertTriangle, color: 'bg-yellow-500', change: '-3' },
    { title: '今日出貨', value: '24', unit: '批次', icon: CheckCircle2, color: 'bg-purple-500', change: '+8' },
  ];

  const inventoryByZone = [
    { name: 'A區', value: 45200 },
    { name: 'B區', value: 32400 },
    { name: 'C區', value: 28100 },
    { name: 'D區', value: 20140 },
  ];

  const dailyTransactions = [
    { date: '05/01', receiving: 12, shipping: 8 },
    { date: '05/02', receiving: 15, shipping: 11 },
    { date: '05/03', receiving: 10, shipping: 14 },
    { date: '05/04', receiving: 18, shipping: 9 },
    { date: '05/05', receiving: 12, shipping: 16 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  const recentActivities = [
    {
      time: '10:23',
      action: '收貨完成',
      detail: 'PO-2024-0501 | IC-001 | 內部批號 IC-001-240501-0001 | 5,000 PCS',
      status: 'success',
    },
    {
      time: '10:15',
      action: '揀貨完成',
      detail: 'SO-2024-0342 | 內部條碼 240310-IC001-0001-W10 | 2,500 PCS',
      status: 'success',
    },
    {
      time: '09:45',
      action: 'IQC 檢驗',
      detail: '內部批號 IC-STM358-240420-0001 | 等待品管確認',
      status: 'warning',
    },
    { time: '09:20', action: '庫存調整', detail: 'A-01-02-01 | 盤點差異 +50 PCS', status: 'info' },
    {
      time: '08:50',
      action: '換標作業',
      detail: '原廠條碼 → internal_barcode 240501-IC001-0001-W15',
      status: 'success',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">{stat.title}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                  <span className="text-sm text-slate-500">{stat.unit}</span>
                </div>
                <p className={`text-sm mt-2 ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.change} 較昨日
                </p>
              </div>
              <div className={`${stat.color} size-12 rounded-lg flex items-center justify-center`}>
                <stat.icon className="size-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">每日收發貨趨勢</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyTransactions}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip />
              <Legend />
              <Bar dataKey="receiving" name="收貨" fill="#3b82f6" />
              <Bar dataKey="shipping" name="出貨" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">庫存分佈 (依區域)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={inventoryByZone}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value.toLocaleString()}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {inventoryByZone.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">最近活動</h3>
        <div className="space-y-3">
          {recentActivities.map((activity, idx) => (
            <div key={idx} className="flex items-start gap-4 pb-3 border-b border-slate-100 last:border-0">
              <span className="text-xs text-slate-500 font-mono min-w-12">{activity.time}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                    activity.status === 'success' ? 'bg-green-100 text-green-700' :
                    activity.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {activity.action}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1">{activity.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
