'use client';

import {
  Chart as ChartJS,
  type ChartOptions,
  type TooltipOptions,
} from 'chart.js';
import { useSyncExternalStore } from 'react';

import { fmtShort } from '@/components/analytics/kit';

/**
 * Chart.js cannot read CSS custom properties, so the analytics charts resolve
 * the design tokens once (and again whenever the theme class flips) and pass
 * plain colour strings to the canvas.
 */
export interface ChartTheme {
  foreground: string;
  subtle: string;
  faint: string;
  hairline: string;
  surface3: string;
  positive: string;
  negative: string;
  invest: string;
  font: string;
}

const FALLBACK: ChartTheme = {
  foreground: '#f5f5f7',
  subtle: '#9a9aa3',
  faint: '#6a6a74',
  hairline: 'rgba(255, 255, 255, 0.08)',
  surface3: '#202026',
  positive: '#3be29a',
  negative: '#ff7a70',
  invest: '#8b9cff',
  font: 'ui-sans-serif, system-ui, sans-serif',
};

function readTheme(): ChartTheme {
  if (typeof window === 'undefined') return FALLBACK;
  const theme = resolveTheme();
  // Canvas text (axis ticks, tooltip) follows the app font and grey.
  ChartJS.defaults.font.family = theme.font;
  ChartJS.defaults.color = theme.subtle;
  return theme;
}

function resolveTheme(): ChartTheme {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback;
  return {
    foreground: v('--foreground', FALLBACK.foreground),
    subtle: v('--text-2', FALLBACK.subtle),
    faint: v('--text-3', FALLBACK.faint),
    hairline: v('--hairline', FALLBACK.hairline),
    surface3: v('--surface-3', FALLBACK.surface3),
    positive: v('--positive', FALLBACK.positive),
    negative: v('--negative', FALLBACK.negative),
    invest: v('--invest', FALLBACK.invest),
    font: getComputedStyle(document.body).fontFamily || FALLBACK.font,
  };
}

let cached: ChartTheme | null = null;

function getSnapshot() {
  cached ??= readTheme();
  return cached;
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(() => {
    const next = readTheme();
    if (JSON.stringify(next) !== JSON.stringify(cached)) {
      cached = next;
      onChange();
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style'],
  });
  return () => observer.disconnect();
}

export function useChartTheme(): ChartTheme {
  return useSyncExternalStore(subscribe, getSnapshot, () => FALLBACK);
}

/** `#rrggbb` / `rgb()` / `rgba()` -> same colour at the given alpha. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(color.trim());
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map((p) => p.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/**
 * "sep 2025" -> "sep"; January (and the first tick) also carry a short year
 * ("ene 26") so a multi-year axis still reads unambiguously.
 */
function shortPeriodLabel(label: string, index: number): string {
  const [rawMonth, year] = label.toLowerCase().replace('.', '').split(' ');
  const month = rawMonth === 'sept' ? 'sep' : rawMonth;
  if (!year || !MONTHS_ES.includes(month)) return label;
  return index === 0 || month === 'ene' ? `${month} ${year.slice(-2)}` : month;
}

function tooltip(theme: ChartTheme): Partial<TooltipOptions> {
  return {
    backgroundColor: theme.surface3,
    titleColor: theme.foreground,
    bodyColor: theme.subtle,
    borderColor: theme.hairline,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 12,
    boxWidth: 8,
    boxHeight: 8,
    boxPadding: 4,
    usePointStyle: true,
    titleFont: { weight: 600, size: 12 },
    bodyFont: { size: 12 },
    caretSize: 0,
  };
}

function scales(theme: ChartTheme, labels: string[] = []) {
  return {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: {
        color: theme.faint,
        font: { size: 11 },
        maxRotation: 0,
        autoSkip: true,
        autoSkipPadding: 12,
        callback: (_value: unknown, index: number) =>
          shortPeriodLabel(labels[index] ?? '', index),
      },
    },
    y: {
      beginAtZero: true,
      grid: { color: theme.hairline, drawTicks: false, lineWidth: 1 },
      border: { display: false },
      ticks: {
        color: theme.faint,
        font: { size: 11 },
        padding: 8,
        maxTicksLimit: 5,
        callback: (value: unknown) => fmtShort(Number(value)),
      },
    },
  };
}

/** Bar options in the house style; tooltip callbacks from `base` are kept. */
export function themedBarOptions(
  theme: ChartTheme,
  labels: string[],
  base: ChartOptions<'bar'> = {},
): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip(theme),
        callbacks: base.plugins?.tooltip?.callbacks,
      },
    },
    scales: scales(theme, labels),
    datasets: {
      bar: {
        borderRadius: 4,
        borderSkipped: 'start',
        maxBarThickness: 14,
        categoryPercentage: 0.7,
        barPercentage: 0.85,
      },
    },
  };
}

export function themedLineOptions(
  theme: ChartTheme,
  labels: string[],
  base: ChartOptions<'line'> = {},
): ChartOptions<'line'> {
  const s = scales(theme, labels);
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip(theme),
        callbacks: base.plugins?.tooltip?.callbacks,
      },
    },
    scales: { x: s.x, y: s.y },
    elements: {
      // A lone period has no line to draw, so show the points instead.
      point: {
        radius: labels.length < 3 ? 3 : 0,
        hoverRadius: 4,
        hitRadius: 12,
      },
      line: { borderWidth: 2, cubicInterpolationMode: 'monotone' },
    },
  };
}
