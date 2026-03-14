import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  User,
  Calendar,
  BarChart3 as BarChart2,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Bell,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  MessageCircle,
  Moon,
  Cog,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { loadDashboardData } from './lib/api';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'leave-requests', label: 'Leave Requests', icon: FileText },
  { key: 'my-leaves', label: 'My Leaves', icon: User, expandable: true },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'reports', label: 'Reports', icon: BarChart2, expandable: true },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const requestees = [
  { name: 'Alice', initials: 'AL', color: 'bg-violet-200' },
  { name: 'Bob', initials: 'BO', color: 'bg-sky-200' },
  { name: 'Carlos', initials: 'CA', color: 'bg-emerald-200' },
  { name: 'Diana', initials: 'DI', color: 'bg-amber-200' },
  { name: 'Evan', initials: 'EV', color: 'bg-rose-200' },
];

const chartDataByRange = {
  'This week': [
    { day: 'Mon', requests: 2 },
    { day: 'Tue', requests: 3 },
    { day: 'Wed', requests: 1 },
    { day: 'Thu', requests: 4 },
    { day: 'Fri', requests: 5 },
    { day: 'Sat', requests: 2 },
    { day: 'Sun', requests: 1 },
  ],
  'This month': [
    { day: 'W1', requests: 3 },
    { day: 'W2', requests: 6 },
    { day: 'W3', requests: 4 },
    { day: 'W4', requests: 7 },
    { day: 'W5', requests: 4 },
    { day: 'W6', requests: 5 },
    { day: 'W7', requests: 3 },
  ],
  'Last month': [
    { day: 'W1', requests: 2 },
    { day: 'W2', requests: 4 },
    { day: 'W3', requests: 5 },
    { day: 'W4', requests: 3 },
    { day: 'W5', requests: 2 },
    { day: 'W6', requests: 4 },
    { day: 'W7', requests: 1 },
  ],
};

const mockPendingApprovals = [
  { name: 'Alice Brown', type: 'Annual Leave', days: '3 days', status: 'Approved', initials: 'AB', color: 'bg-violet-200' },
  { name: 'Bob Carter', type: 'Sick Leave', days: '1 day', status: 'Pending', initials: 'BC', color: 'bg-sky-200' },
  { name: 'Carlos Ruiz', type: 'Casual Leave', days: '2 days', status: 'Declined', initials: 'CR', color: 'bg-rose-200' },
  { name: 'Diana Fox', type: 'Maternity Leave', days: '14 days', status: 'Pending', initials: 'DF', color: 'bg-amber-200' },
  { name: 'Evan Stone', type: 'Emergency Leave', days: '2 days', status: 'Approved', initials: 'ES', color: 'bg-emerald-200' },
];

const comments = [
  {
    user: 'Alice',
    context: 'on Annual Leave Request',
    time: '12m ago',
    text: 'Can we move the start date to next Monday due to exam scheduling?',
    initials: 'AL',
    color: 'bg-violet-200',
  },
  {
    user: 'Bob',
    context: 'on Sick Leave Request',
    time: '45m ago',
    text: 'Medical certificate uploaded. Please prioritize this approval.',
    initials: 'BO',
    color: 'bg-sky-200',
  },
];

const leaveTypes = ['Annual', 'Sick', 'Casual', 'Maternity', 'Emergency'];

const mockOverviewByRange = {
  'This week': { total: 19, approved: 14, newRequests: 4, watermark: 24 },
  'This month': { total: 48, approved: 36, newRequests: 12, watermark: 24 },
  'Last month': { total: 42, approved: 31, newRequests: 9, watermark: 24 },
};

const avatarColors = ['bg-violet-200', 'bg-sky-200', 'bg-emerald-200', 'bg-amber-200', 'bg-rose-200'];

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function toTitle(value) {
  if (!value) return 'Leave';
  return value
    .toString()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function mapStatus(status) {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Declined';
  return 'Pending';
}

function StatusBadge({ status }) {
  const styles = {
    Approved: 'bg-green-100 text-green-700',
    Declined: 'bg-red-100 text-red-700',
    Pending: 'bg-orange-100 text-orange-700',
  };

  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function TrendBadge({ positive, value }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
        positive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
      }`}
    >
      {positive ? '↑' : '↓'} {value}
    </span>
  );
}

function Selector({ value, options, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-full border border-gray-200 bg-white px-4 py-1.5 pr-8 text-sm text-textPrimary"
      >
        {options.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-textPrimary">{payload[0].value} Requests</p>
    </div>
  );
}

function ApplyLeaveModal({ open, onClose }) {
  const [form, setForm] = useState({
    employeeName: '',
    leaveType: leaveTypes[0],
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (submitted) setSubmitted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.employeeName || !form.startDate || !form.endDate || !form.reason) {
      setSubmitted(true);
      return;
    }

    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-textPrimary">Apply Leave</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-gray-200 px-3 py-1 text-sm">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[14px] text-textPrimary">Employee name</label>
            <input
              type="text"
              value={form.employeeName}
              onChange={(e) => updateField('employeeName', e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              placeholder="Enter employee name"
            />
          </div>

          <div>
            <label className="mb-1 block text-[14px] text-textPrimary">Leave type</label>
            <select
              value={form.leaveType}
              onChange={(e) => updateField('leaveType', e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
            >
              {leaveTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[14px] text-textPrimary">Start date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-[14px] text-textPrimary">End date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[14px] text-textPrimary">Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => updateField('reason', e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
              placeholder="Write a short reason"
            />
          </div>

          {submitted && (
            <p className="text-xs text-red-600">Please fill all required fields before submitting.</p>
          )}

          <button
            type="submit"
            className="rounded-[20px] bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [overviewRange, setOverviewRange] = useState('This month');
  const [chartRange, setChartRange] = useState('Last 7 days');
  const [openModal, setOpenModal] = useState(false);
  const [apiOverview, setApiOverview] = useState(null);
  const [apiChartData, setApiChartData] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState(mockPendingApprovals);
  const [usingLiveData, setUsingLiveData] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function hydrateDashboard() {
      const result = await loadDashboardData();
      if (!mounted || !result) return;

      const approvedCount = (result.summary.byStatus || []).reduce((count, item) => {
        const nextCount = Number(item.count) || 0;
        return item.status === 'approved' ? count + nextCount : count;
      }, 0);

      const pendingCount = (result.summary.byStatus || []).reduce((count, item) => {
        const value = Number(item.count) || 0;
        return item.status?.startsWith('pending') ? count + value : count;
      }, 0);

      const mappedApprovals = (result.leaves || []).slice(0, 5).map((leave, index) => ({
        name: leave.student_name || 'Employee',
        type: `${toTitle(leave.leave_type)} Leave`,
        days: `${leave.total_days || 1} day${leave.total_days > 1 ? 's' : ''}`,
        status: mapStatus(leave.status),
        initials: getInitials(leave.student_name || 'Employee'),
        color: avatarColors[index % avatarColors.length],
      }));

      const mappedTrends = (result.trends || []).slice(-7).map((row) => ({
        day: row.month?.slice(5) || 'N/A',
        requests: Number(row.count) || 0,
      }));

      setApiOverview({
        total: Number(result.summary.total) || 0,
        approved: approvedCount,
        newRequests: pendingCount,
        watermark: Number(result.summary.total) || 24,
      });
      setApiChartData(mappedTrends);
      if (mappedApprovals.length) setPendingApprovals(mappedApprovals);
      setUsingLiveData(true);
    }

    hydrateDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const chartMap = {
    'Last 7 days': chartDataByRange['This week'],
    'This month': chartDataByRange['This month'],
    'Last month': chartDataByRange['Last month'],
  };

  const displayOverview = usingLiveData ? apiOverview : mockOverviewByRange[overviewRange];

  const chartData = useMemo(() => {
    const fallback = chartMap[chartRange] || chartDataByRange['This week'];
    const base = usingLiveData && apiChartData.length && chartRange === 'Last 7 days' ? apiChartData : fallback;
    return base.map((item, index) => ({ ...item, color: index === 3 ? '#22C55E' : '#E5E7EB' }));
  }, [chartRange, usingLiveData, apiChartData]);

  return (
    <div className="min-h-screen bg-page px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 rounded-2xl bg-white p-4 shadow-md lg:flex-row lg:p-5">
        <aside className="w-full rounded-2xl bg-white p-4 lg:w-[220px] lg:p-2">
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-black text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-base font-bold text-textPrimary">LeaveFlow</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveNav(item.key)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? 'bg-white font-semibold text-textPrimary shadow-sm ring-1 ring-gray-100'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {item.expandable ? <ChevronRight className="h-4 w-4 text-gray-400" /> : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-8 flex items-center justify-center gap-3 border-t border-gray-100 pt-4">
            <button type="button" className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <MessageCircle className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <Moon className="h-4 w-4" />
            </button>
            <button type="button" className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900">
              <Cog className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-4">
          <header className="flex flex-col gap-3 rounded-2xl bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-[28px] font-bold leading-none text-textPrimary">Dashboard</h1>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="relative w-full min-w-[220px] sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search anything..."
                  className="w-full rounded-full border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-400"
                />
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(true)}
                className="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Apply Leave
              </button>
              <button type="button" className="rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-100">
                <Bell className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-full border border-gray-200 p-2 text-gray-600 hover:bg-gray-100">
                <MessageSquare className="h-4 w-4" />
              </button>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gray-900 text-xs font-semibold text-white">JD</div>
            </div>
          </header>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-textPrimary">Overview</h2>
              <Selector
                value={overviewRange}
                options={['This week', 'This month', 'Last month']}
                onChange={setOverviewRange}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 p-4">
                <div className="mb-3 flex items-center gap-2 text-textSecondary">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-[14px]">Leave Requests</span>
                </div>
                <p className="text-[48px] font-bold leading-none text-textPrimary">{displayOverview?.total ?? 48}</p>
                <div className="mt-3">
                  <TrendBadge positive value="12.5% vs last month" />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 p-4">
                <div className="mb-3 flex items-center gap-2 text-textSecondary">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-green-50 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                  <span className="text-[14px]">Approved</span>
                </div>
                <p className="text-[48px] font-bold leading-none text-textPrimary">{displayOverview?.approved ?? 36}</p>
                <div className="mt-3">
                  <TrendBadge positive value="8.2% vs last month" />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
              <p className="text-[14px] font-medium text-textPrimary">{displayOverview?.newRequests ?? 12} new requests today!</p>
              <p className="mt-1 text-[12px] text-textSecondary">Send approval reminders to pending requests.</p>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-textPrimary">Recent Requestees</h3>
              </div>
              <div className="flex flex-wrap gap-4">
                {requestees.map((person) => (
                  <div key={person.name} className="group text-center">
                    <div className="relative">
                      <div
                        className={`mx-auto grid h-12 w-12 place-items-center rounded-full ring-2 ring-white ${person.color}`}
                        title={person.name}
                      >
                        <span className="text-xs font-semibold text-gray-700">{person.initials}</span>
                      </div>
                      <div className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 rounded-md bg-black px-2 py-1 text-[11px] text-white group-hover:block">
                        {person.name}
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] text-textSecondary">{person.name}</p>
                  </div>
                ))}

                <div className="text-center">
                  <button
                    type="button"
                    className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="mt-2 text-[12px] text-textSecondary">View all</p>
                </div>
              </div>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-textPrimary">Leave Activity</h2>
              <Selector
                value={chartRange}
                options={['Last 7 days', 'This month', 'Last month']}
                onChange={setChartRange}
              />
            </div>

            <div className="h-[230px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={26} margin={{ top: 10, right: 10, left: -18, bottom: 10 }}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <YAxis hide domain={[0, 'dataMax + 1']} />
                  <Tooltip cursor={{ fill: '#F8FAFC' }} content={<ChartTooltip />} />
                  <Bar dataKey="requests" radius={[10, 10, 10, 10]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="pointer-events-none absolute bottom-2 left-5 text-[72px] font-bold leading-none text-gray-100">
              {(displayOverview?.watermark ?? 24)} Total
            </p>
          </section>
        </main>

        <aside className="w-full space-y-4 lg:w-[300px]">
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-[18px] font-semibold text-textPrimary">Pending Approvals</h2>
            <div className="space-y-3">
              {pendingApprovals.map((item) => (
                <div key={`${item.name}-${item.type}`} className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${item.color}`}>
                      <span className="text-xs font-semibold text-gray-700">{item.initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-textPrimary">{item.name}</p>
                      <p className="truncate text-xs text-textSecondary">{item.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-textSecondary">{item.days}</p>
                    <div className="mt-1">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-4 w-full rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-textPrimary hover:bg-gray-50"
            >
              All requests
            </button>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 className="mb-4 text-[18px] font-semibold text-textPrimary">Recent Comments</h2>
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={`${comment.user}-${comment.time}`} className="rounded-xl border border-gray-100 p-3">
                  <div className="mb-2 flex items-center gap-3">
                    <div className={`grid h-9 w-9 place-items-center rounded-full ${comment.color}`}>
                      <span className="text-xs font-semibold text-gray-700">{comment.initials}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-textPrimary">
                        {comment.user} <span className="font-normal text-textSecondary">{comment.context}</span>
                      </p>
                      <p className="text-[12px] text-textSecondary">{comment.time}</p>
                    </div>
                  </div>
                  <p className="text-[12px] text-textSecondary">{comment.text}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <ApplyLeaveModal open={openModal} onClose={() => setOpenModal(false)} />
    </div>
  );
}
