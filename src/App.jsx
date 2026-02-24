import { useState, useMemo, useCallback } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts'
import {
    TrendingUp, DollarSign, Calendar, Percent, PiggyBank,
    Download, FileText, ChevronDown, ChevronUp, Info
} from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmt = (val) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)

const fmtShort = (val) => {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
    return `$${val.toFixed(0)}`
}

// ─── Core Calculation ──────────────────────────────────────────────────────

function calcTimeline({ capitalInicial, aportacionMensual, tasaAnual, tasaInflacion, anios }) {
    const n = 12 // compounding monthly
    const r = tasaAnual / 100
    const inf = tasaInflacion / 100

    const rows = []
    for (let y = 0; y <= anios; y++) {
        const t = y
        const factor = Math.pow(1 + r / n, n * t)
        const nominal = capitalInicial * factor + (r > 0
            ? aportacionMensual * ((factor - 1) / (r / n))
            : aportacionMensual * n * t)
        const capitalInvertido = capitalInicial + aportacionMensual * 12 * t
        const inflFactor = Math.pow(1 + inf, t)
        const real = nominal / inflFactor

        rows.push({
            año: y,
            label: `Año ${y}`,
            capitalInvertido: Math.round(capitalInvertido),
            valorNominal: Math.round(nominal),
            valorReal: Math.round(real),
        })
    }
    return rows
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────

const AreaTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
        <div className="glass-card rounded-xl p-3 text-xs shadow-2xl min-w-[200px]">
            <p className="font-semibold text-brand-300 mb-2">{label}</p>
            {payload.map((p) => (
                <div key={p.dataKey} className="flex justify-between gap-4 mb-1">
                    <span style={{ color: p.color }} className="font-medium">{p.name}</span>
                    <span className="text-white font-semibold">{fmtShort(p.value)}</span>
                </div>
            ))}
        </div>
    )
}

const DonutTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const { name, value, payload: { percent } } = payload[0]
    return (
        <div className="glass-card rounded-xl p-3 text-xs shadow-2xl">
            <p className="font-semibold text-brand-300">{name}</p>
            <p className="text-white font-bold text-sm mt-1">{fmtShort(value)}</p>
            <p className="text-slate-400">{(percent * 100).toFixed(1)}%</p>
        </div>
    )
}

// ─── Input Slider Card ─────────────────────────────────────────────────────

function InputRow({ icon: Icon, label, value, onChange, min, max, step = 1, prefix = '', suffix = '', color = 'brand' }) {
    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Icon size={14} />
                    <span>{label}</span>
                </div>
                <div className="flex items-center gap-1 bg-surface-600 rounded-lg px-2 py-1">
                    {prefix && <span className="text-slate-400 text-xs">{prefix}</span>}
                    <input
                        type="number"
                        value={value}
                        min={min} max={max} step={step}
                        onChange={e => onChange(Number(e.target.value))}
                        className="bg-transparent text-white text-sm font-semibold w-20 text-right outline-none"
                    />
                    {suffix && <span className="text-slate-400 text-xs">{suffix}</span>}
                </div>
            </div>
            <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: color === 'violet' ? '#a78bfa' : '#3d57ff' }}
            />
            <div className="flex justify-between text-[10px] text-slate-600">
                <span>{prefix}{min}{suffix}</span>
                <span>{prefix}{max.toLocaleString('es-ES')}{suffix}</span>
            </div>
        </div>
    )
}

// ─── KPI Card ──────────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, color = '#6381ff', icon: Icon }) {
    return (
        <div className="glass-card rounded-2xl p-5 flex flex-col gap-2 glow-blue">
            <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{title}</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${color}22` }}>
                    <Icon size={14} style={{ color }} />
                </div>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            {subtitle && <p className="text-slate-500 text-xs">{subtitle}</p>}
        </div>
    )
}

// ─── Export Helpers ────────────────────────────────────────────────────────

function exportCSV(timeline, params) {
    const headers = ['Año', 'Capital Invertido', 'Valor Nominal', 'Valor Real']
    const rows = timeline.map(r => [r.año, r.capitalInvertido, r.valorNominal, r.valorReal])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ahorro_proyeccion.csv'
    a.click()
    URL.revokeObjectURL(url)
}

async function exportPDF(timeline, params, resultado) {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.setTextColor(61, 87, 255)
    doc.text('Calculadora de Ahorro Real', 14, 20)

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 120)
    doc.text(`Capital inicial: $${params.capitalInicial.toLocaleString()}`, 14, 32)
    doc.text(`Aportación mensual: $${params.aportacionMensual.toLocaleString()}`, 14, 38)
    doc.text(`Tasa interés anual: ${params.tasaAnual}%`, 14, 44)
    doc.text(`Inflación anual: ${params.tasaInflacion}%`, 14, 50)
    doc.text(`Período: ${params.anios} años`, 14, 56)

    doc.setFontSize(11)
    doc.setTextColor(61, 87, 255)
    doc.text('Resultados finales', 14, 68)
    doc.setTextColor(50, 50, 50)
    doc.setFontSize(10)
    doc.text(`Valor nominal: ${fmt(resultado.nominal)}`, 14, 76)
    doc.text(`Valor real (ajustado): ${fmt(resultado.real)}`, 14, 82)
    doc.text(`Total aportado: ${fmt(resultado.capitalInvertido)}`, 14, 88)
    doc.text(`Intereses generados: ${fmt(resultado.intereses)}`, 14, 94)

    autoTable(doc, {
        startY: 104,
        head: [['Año', 'Capital Invertido', 'Valor Nominal', 'Valor Real']],
        body: timeline.map(r => [r.año, fmt(r.capitalInvertido), fmt(r.valorNominal), fmt(r.valorReal)]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [61, 87, 255] },
        alternateRowStyles: { fillColor: [245, 246, 250] },
    })

    doc.save('ahorro_proyeccion.pdf')
}

// ─── Main App ──────────────────────────────────────────────────────────────

export default function App() {
    const [capitalInicial, setCapitalInicial] = useState(10000)
    const [edadActual, setEdadActual] = useState(30)
    const [edadRetiro, setEdadRetiro] = useState(65)
    const [tasaAnual, setTasaAnual] = useState(8)
    const [aportacionMensual, setAportacionMensual] = useState(500)
    const [tasaInflacion, setTasaInflacion] = useState(3)
    const [showTable, setShowTable] = useState(false)

    const anios = Math.max(edadRetiro - edadActual, 1)

    const timeline = useMemo(() =>
        calcTimeline({ capitalInicial, aportacionMensual, tasaAnual, tasaInflacion, anios }),
        [capitalInicial, aportacionMensual, tasaAnual, tasaInflacion, anios]
    )

    const finalRow = timeline[timeline.length - 1]
    const resultado = {
        nominal: finalRow.valorNominal,
        real: finalRow.valorReal,
        capitalInvertido: finalRow.capitalInvertido,
        intereses: finalRow.valorNominal - finalRow.capitalInvertido,
    }

    const DONUT_DATA = [
        { name: 'Capital Aportado', value: resultado.capitalInvertido },
        { name: 'Intereses Generados', value: Math.max(resultado.intereses, 0) },
    ]
    const DONUT_COLORS = ['#6381ff', '#a78bfa']

    const params = { capitalInicial, aportacionMensual, tasaAnual, tasaInflacion, anios }

    return (
        <div className="min-h-screen bg-surface-900">
            {/* ── Header ── */}
            <header className="border-b border-surface-600 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center animate-pulse-glow">
                            <TrendingUp size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-white text-lg leading-tight">Calculadora de Ahorro Real</h1>
                            <p className="text-slate-500 text-xs">Ajustada por inflación · Interés compuesto mensual</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => exportCSV(timeline, params)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-600 hover:bg-surface-500 text-slate-300 hover:text-white text-xs font-medium transition-all"
                        >
                            <Download size={14} /> CSV
                        </button>
                        <button
                            onClick={() => exportPDF(timeline, params, resultado)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-all"
                        >
                            <FileText size={14} /> PDF
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── LEFT: Controls ── */}
                <aside className="lg:col-span-1 space-y-6">
                    <div className="glass-card rounded-2xl p-6 space-y-6">
                        <p className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Parámetros</p>

                        <InputRow icon={DollarSign} label="Capital Inicial" value={capitalInicial}
                            onChange={setCapitalInicial} min={0} max={500000} step={1000} prefix="$" />

                        <InputRow icon={PiggyBank} label="Aportación Mensual" value={aportacionMensual}
                            onChange={setAportacionMensual} min={0} max={10000} step={100} prefix="$" />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="flex items-center gap-1.5 text-slate-400 text-xs"><Calendar size={13} />Edad Actual</label>
                                <input type="number" value={edadActual} min={18} max={80}
                                    onChange={e => setEdadActual(Number(e.target.value))}
                                    className="w-full bg-surface-600 text-white rounded-xl px-3 py-2 text-sm font-semibold outline-none border border-transparent focus:border-brand-500 transition-all" />
                            </div>
                            <div className="space-y-1">
                                <label className="flex items-center gap-1.5 text-slate-400 text-xs"><Calendar size={13} />Edad de Retiro</label>
                                <input type="number" value={edadRetiro} min={edadActual + 1} max={100}
                                    onChange={e => setEdadRetiro(Number(e.target.value))}
                                    className="w-full bg-surface-600 text-white rounded-xl px-3 py-2 text-sm font-semibold outline-none border border-transparent focus:border-brand-500 transition-all" />
                            </div>
                        </div>

                        <div className="bg-surface-700 rounded-xl px-3 py-2 text-center">
                            <span className="text-slate-400 text-xs">Período de ahorro: </span>
                            <span className="text-brand-300 font-bold">{anios} años</span>
                        </div>

                        <InputRow icon={Percent} label="Interés Anual" value={tasaAnual}
                            onChange={setTasaAnual} min={0.1} max={25} step={0.1} suffix="%" color="brand" />

                        <InputRow icon={Percent} label="Inflación Anual" value={tasaInflacion}
                            onChange={setTasaInflacion} min={0.1} max={15} step={0.1} suffix="%" color="violet" />
                    </div>

                    {/* ── Donut Chart ── */}
                    <div className="glass-card rounded-2xl p-6">
                        <p className="text-xs uppercase tracking-widest text-brand-400 font-semibold mb-4">Composición del Capital</p>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={DONUT_DATA} cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={85}
                                    paddingAngle={3} dataKey="value"
                                    stroke="none"
                                >
                                    {DONUT_DATA.map((entry, i) => (
                                        <Cell key={i} fill={DONUT_COLORS[i]} opacity={0.9} />
                                    ))}
                                </Pie>
                                <Tooltip content={<DonutTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-1">
                            {DONUT_DATA.map((d, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS[i] }} />
                                        <span className="text-slate-400">{d.name}</span>
                                    </div>
                                    <span className="text-white font-semibold">{fmtShort(d.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* ── RIGHT: KPIs + Area Chart ── */}
                <section className="lg:col-span-2 space-y-6">

                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <KpiCard title="Valor Nominal" value={fmtShort(resultado.nominal)}
                            subtitle="Lo que dirá el banco" color="#6381ff" icon={TrendingUp} />
                        <KpiCard title="Valor Real" value={fmtShort(resultado.real)}
                            subtitle="Poder adquisitivo hoy" color="#a78bfa" icon={DollarSign} />
                        <KpiCard title="Total Aportado" value={fmtShort(resultado.capitalInvertido)}
                            subtitle="Tu dinero invertido" color="#34d399" icon={PiggyBank} />
                        <KpiCard title="Intereses" value={fmtShort(resultado.intereses)}
                            subtitle="Ganancia neta" color="#f59e0b" icon={Percent} />
                    </div>

                    {/* Real vs Nominal info badge */}
                    <div className="flex items-start gap-2 bg-surface-700 rounded-xl px-4 py-3 border border-brand-900">
                        <Info size={14} className="text-brand-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-slate-400">
                            Tu dinero valdrá nominalmente <span className="text-white font-semibold">{fmt(resultado.nominal)}</span> pero
                            con una inflación del <span className="text-violet-400 font-semibold">{tasaInflacion}%</span>, su poder adquisitivo
                            equivale a <span className="text-violet-300 font-semibold">{fmt(resultado.real)}</span> de hoy. La diferencia
                            es <span className="text-amber-400 font-semibold">{fmt(resultado.nominal - resultado.real)}</span>.
                        </p>
                    </div>

                    {/* Area Chart */}
                    <div className="glass-card rounded-2xl p-6">
                        <p className="text-xs uppercase tracking-widest text-brand-400 font-semibold mb-6">Evolución Temporal</p>
                        <ResponsiveContainer width="100%" height={340}>
                            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradNominal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6381ff" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#6381ff" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="gradCapital" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e2747" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: '#64748b', fontSize: 11 }}
                                    tickLine={false} axisLine={false}
                                    interval={Math.floor(anios / 5)}
                                />
                                <YAxis
                                    tickFormatter={fmtShort}
                                    tick={{ fill: '#64748b', fontSize: 11 }}
                                    tickLine={false} axisLine={false}
                                    width={60}
                                />
                                <Tooltip content={<AreaTooltip />} />
                                <Legend
                                    wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                                    formatter={(value) => <span style={{ color: '#94a3b8' }}>{value}</span>}
                                />
                                <Area
                                    type="monotone" dataKey="capitalInvertido" name="Capital Invertido"
                                    stroke="#34d399" strokeWidth={2}
                                    fill="url(#gradCapital)"
                                />
                                <Area
                                    type="monotone" dataKey="valorNominal" name="Valor Nominal"
                                    stroke="#6381ff" strokeWidth={2.5}
                                    fill="url(#gradNominal)"
                                />
                                <Area
                                    type="monotone" dataKey="valorReal" name="Valor Real (Ajustado)"
                                    stroke="#a78bfa" strokeWidth={2.5}
                                    fill="url(#gradReal)" strokeDasharray="6 3"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ── Collapsible Year-by-Year Table ── */}
                    <div className="glass-card rounded-2xl overflow-hidden">
                        <button
                            onClick={() => setShowTable(v => !v)}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-600 transition-all"
                        >
                            <span className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Tabla año a año</span>
                            {showTable ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </button>
                        {showTable && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-t border-surface-600">
                                            {['Año', 'Edad', 'Capital Aportado', 'Valor Nominal', 'Valor Real'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left text-slate-500 font-semibold">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {timeline.map((r, i) => (
                                            <tr key={i} className={`border-t border-surface-700 ${i % 2 === 0 ? 'bg-surface-800' : ''} hover:bg-surface-700 transition-colors`}>
                                                <td className="px-4 py-2.5 text-slate-300 font-medium">{r.año}</td>
                                                <td className="px-4 py-2.5 text-slate-400">{edadActual + r.año}</td>
                                                <td className="px-4 py-2.5 text-emerald-400">{fmtShort(r.capitalInvertido)}</td>
                                                <td className="px-4 py-2.5 text-brand-300 font-semibold">{fmtShort(r.valorNominal)}</td>
                                                <td className="px-4 py-2.5 text-violet-300 font-semibold">{fmtShort(r.valorReal)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </section>
            </main>

            <footer className="text-center text-slate-700 text-xs py-6">
                Calculadora de Ahorro Real · Interés compuesto mensual ajustado por inflación
            </footer>
        </div>
    )
}
