"use client";

import { useState } from "react";
import { Banknote, CircleDollarSign, Percent, ShoppingCart, TrendingUp, WalletCards, PackageCheck } from "lucide-react";
import type { AdminRevenue } from "@/lib/admin";
import { useA } from "@/components/livka/i18n-context";
import { money } from "@/lib/wallet-shared";

/** Income = paid sales + kept withdrawal fees. Customer top-ups are shown separately as customer funds. */
export function RevenuePanel({ revenue }: { revenue: AdminRevenue }) {
  const { a, t, intl } = useA();
  const [hover, setHover] = useState<number | null>(null);
  const days = revenue.daily;
  const totals = days.map((d) => d.salesCents + d.feesCents);
  const max = Math.max(1, ...totals);
  const hasIncome = totals.some((v) => v > 0);
  const shown = hover ?? days.length - 1;
  const shownDay = days[shown];
  const fmtDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" });
  const trend = revenue.prevMonthCents > 0 ? Math.round(((revenue.monthCents - revenue.prevMonthCents) / revenue.prevMonthCents) * 100) : null;
  const topRevenue = Math.max(1, ...revenue.byProduct.map((p) => p.cents));
  const name = (slug: string, fallback: string) => t.products[slug as keyof typeof t.products]?.name ?? fallback;

  const headline = [
    { label: a.iTotal, value: money(revenue.totalCents, true), note: a.iTotalNote, icon: <CircleDollarSign />, tone: "amber" },
    { label: a.iMonth, value: money(revenue.monthCents, true), note: a.vsPrev, icon: <TrendingUp />, tone: "violet", trend },
    { label: a.iWeek, value: money(revenue.weekCents, true), note: `${fmtDay(days[days.length - 7].date)} – ${fmtDay(days[days.length - 1].date)}`, icon: <TrendingUp />, tone: "blue" },
    { label: a.iToday, value: money(revenue.todayCents, true), note: fmtDay(days[days.length - 1].date), icon: <TrendingUp />, tone: "mint" },
  ];
  const details = [
    { label: a.iSales, value: money(revenue.salesCents, true), note: a.iSalesNote(revenue.ordersCount), icon: <ShoppingCart />, tone: "violet" },
    { label: a.iAvg, value: money(revenue.avgOrderCents, true), note: a.iAvgNote, icon: <PackageCheck />, tone: "blue" },
    { label: a.iFees, value: money(revenue.feesCents, true), note: a.iFeesNote, icon: <Percent />, tone: "mint" },
    { label: a.iDeposits, value: money(revenue.depositsCents, true), note: a.iDepositsNote, icon: <WalletCards />, tone: "amber" },
    { label: a.iPayouts, value: money(revenue.payoutsCents, true), note: a.iPayoutsNote, icon: <Banknote />, tone: "rose" },
    { label: a.colOrders, value: revenue.ordersCount.toLocaleString(intl), note: a.iSales, icon: <ShoppingCart />, tone: "violet" },
  ];

  return <>
    <section className="ad-stats">
      {headline.map((c) => <article key={c.label}><span className={c.tone}>{c.icon}</span><div><small>{c.label}</small><b>{c.value}</b><p>{c.trend != null && <em className={`ad-trend ${c.trend >= 0 ? "up" : "down"}`}>{c.trend >= 0 ? "+" : ""}{c.trend}%</em>}{c.note}</p></div></article>)}
    </section>

    <section className="ad-card ad-chart-card">
      <div className="ad-card-head">
        <div><span>{a.chartEyebrow}</span><h2>{a.chartTitle}</h2></div>
        <div className="ad-chart-legend"><span><i className="s" />{a.legendSales}</span><span><i className="f" />{a.legendFees}</span></div>
      </div>
      <div className="ad-chart">
        {hasIncome ? <>
          <div className="ad-bars" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => {
              const total = d.salesCents + d.feesCents;
              return <div key={d.date} className={`ad-bar ${i === shown ? "on" : ""}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} role="img" aria-label={a.chartTip(fmtDay(d.date), money(total, true), d.orders)}>
                <span className="f" style={{ height: `${(d.feesCents / max) * 100}%` }} />
                <span className="s" style={{ height: `${(d.salesCents / max) * 100}%` }} />
              </div>;
            })}
          </div>
          <div className="ad-axis"><span>{fmtDay(days[0].date)}</span><span>{fmtDay(days[Math.floor(days.length / 2)].date)}</span><span>{fmtDay(days[days.length - 1].date)}</span></div>
          <p className="ad-chart-tip">{a.chartTip(fmtDay(shownDay.date), money(shownDay.salesCents + shownDay.feesCents, true), shownDay.orders)}</p>
        </> : <div className="ad-empty"><TrendingUp size={28} /><b>{a.chartEmpty}</b></div>}
      </div>
    </section>

    <section className="ad-stats ad-stats-3">
      {details.map((c) => <article key={c.label}><span className={c.tone}>{c.icon}</span><div><small>{c.label}</small><b>{c.value}</b><p>{c.note}</p></div></article>)}
    </section>

    <section className="ad-grid">
      <div className="ad-card">
        <div className="ad-card-head"><div><span>{a.byEyebrow}</span><h2>{a.byTitle}</h2></div></div>
        {revenue.byProduct.length ? <div className="ad-rev-list">
          <div className="ad-rev-row ad-rev-head"><span>{a.colProduct}</span><span>{a.colOrders}</span><span>{a.colRevenue}</span></div>
          {revenue.byProduct.map((p) => <div className="ad-rev-row" key={p.slug}>
            <span><b>{name(p.slug, p.title)}</b><span className="ad-share"><i style={{ width: `${(p.cents / topRevenue) * 100}%` }} /></span></span>
            <span>{p.orders}</span><span className="ad-rev-money">{money(p.cents, true)}</span>
          </div>)}
        </div> : <div className="ad-empty">{a.byEmpty}</div>}
      </div>
      <div className="ad-card">
        <div className="ad-card-head"><div><span>{a.recentSalesEyebrow}</span><h2>{a.recentSalesTitle}</h2></div></div>
        {revenue.recent.length ? <div className="ad-rev-list">{revenue.recent.map((r) => <div className="ad-rev-row ad-rev-sale" key={r.orderNo}>
          <span><b>{name(r.slug, r.title)}</b><small>{r.buyer} · {a.orderWord(r.orderNo)}</small></span>
          <span className="ad-rev-date">{new Date(r.createdAt).toLocaleString(intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          <span className="ad-rev-money">+{money(r.totalCents, true)}</span>
        </div>)}</div> : <div className="ad-empty">{a.noSales}</div>}
      </div>
    </section>
  </>;
}
