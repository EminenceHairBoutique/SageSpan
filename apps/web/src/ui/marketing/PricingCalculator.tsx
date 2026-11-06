"use client";

import { useState } from "react";
import { PRICING, formatUsd, pilotMonthlyUsd, standardMonthlyUsd } from "@sagespan/contracts";
import { inputClasses } from "@/ui/primitives";

export function PricingCalculator() {
  const [households, setHouseholds] = useState(250);
  const h = Number.isFinite(households) && households >= 0 ? Math.floor(households) : 0;
  const monthly = standardMonthlyUsd(h);
  const extra = Math.max(0, h - PRICING.standard.includedHouseholds);
  const pilot = pilotMonthlyUsd(h);
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <label htmlFor="households" className="block text-sm font-medium">
        Active monitored households
      </label>
      <div className="mt-2 flex items-center gap-3">
        <input id="households" type="range" min={0} max={2000} step={10} value={h} onChange={(e) => setHouseholds(Number(e.target.value))} className="w-full accent-navy" aria-valuemin={0} aria-valuemax={2000} aria-valuenow={h} />
        <input type="number" min={0} max={100000} value={h} onChange={(e) => setHouseholds(Number(e.target.value))} className={`${inputClasses} w-28`} aria-label="Active monitored households (number)" />
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-surface-muted p-3">
          <dt className="text-xs text-ink-muted">Illustrative monthly</dt>
          <dd className="text-2xl font-bold tabular" data-testid="price-monthly">
            {formatUsd(monthly)}
          </dd>
        </div>
        <div className="rounded-lg bg-surface-muted p-3">
          <dt className="text-xs text-ink-muted">Illustrative annual run-rate</dt>
          <dd className="text-2xl font-bold tabular">{formatUsd(monthly * 12)}</dd>
        </div>
        <div className="rounded-lg bg-surface-muted p-3">
          <dt className="text-xs text-ink-muted">Design-partner pilot</dt>
          <dd className="text-2xl font-bold tabular">{pilot === null ? "n/a" : formatUsd(pilot)}</dd>
          <dd className="text-xs text-ink-muted">{pilot === null ? `pilots cover up to ${PRICING.pilot.maxHouseholds} households` : "limited period, separately agreed"}</dd>
        </div>
      </dl>
      <p className="mt-3 font-mono text-xs text-ink-muted">
        {PRICING.standard.minimumMonthlyUsd} + {PRICING.standard.perAdditionalHouseholdUsd.toFixed(2)} × max(0, {h} − {PRICING.standard.includedHouseholds}) = {PRICING.standard.minimumMonthlyUsd} + {PRICING.standard.perAdditionalHouseholdUsd.toFixed(2)} × {extra} = {formatUsd(monthly)}
      </p>
    </div>
  );
}
