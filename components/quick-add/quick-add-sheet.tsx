'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  Delete,
  Loader2,
  NotebookPen,
  Plus,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CategoryTile, paymentIcon } from './category-icon';
import {
  loadMemory,
  orderOptions,
  rememberSave,
  type QuickAddMemory,
} from './memory';

import { QuickEntryBar } from '@/components/ai/QuickEntryBar';
import { ReceiptUpload } from '@/components/ai/ReceiptUpload';
import { toast } from '@/hooks/use-toast';
import { createEntry } from '@/lib/actions';
import { cn, formatCurrency, shouldSplitTransaction } from '@/lib/utils';

type Accion = 'Gasto' | 'Ingreso' | 'Inversión';
type Mode = 'form' | 'ai' | 'receipt';
type Field = 'cantidad' | 'que' | 'tipo' | 'plataforma_pago';

type Hints = {
  tipoAccion: Record<string, string>;
  byQue: Record<string, { tipo: string; plataforma_pago: string }>;
};

type Options = {
  hints: Hints | null;
  tipo: string[];
  que: string[];
  plataforma_pago: string[];
  quien: string[];
};

const ACCIONES: { value: Accion; icon: typeof ArrowUpRight }[] = [
  { value: 'Gasto', icon: ArrowUpRight },
  { value: 'Ingreso', icon: ArrowDownLeft },
  { value: 'Inversión', icon: TrendingUp },
];

const FIELD_LABEL: Record<Field, string> = {
  cantidad: 'importe',
  que: 'qué',
  tipo: 'categoría',
  plataforma_pago: 'pago',
};

const SAVE_VERB: Record<Accion, string> = {
  Gasto: 'Guardar gasto',
  Ingreso: 'Guardar ingreso',
  Inversión: 'Guardar inversión',
};

const SAVED_TITLE: Record<Accion, string> = {
  Gasto: 'Gasto guardado',
  Ingreso: 'Ingreso guardado',
  Inversión: 'Inversión guardada',
};

const MAX_INT_DIGITS = 7;

/** "12,5" -> 12.5; "" -> 0. */
function parseAmount(raw: string) {
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Group thousands while typing, keeping the user's partial decimals. */
function displayAmount(raw: string) {
  if (!raw) return { int: '0', dec: '' };
  const [i, d] = raw.split(',') as [string, string?];
  const int = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return { int, dec: d === undefined ? '' : `,${d}` };
}

function whenLabel(when: Date | null) {
  if (!when) return 'Ahora';
  const time = format(when, 'HH:mm');
  if (isToday(when)) return `Hoy, ${time}`;
  if (isYesterday(when)) return `Ayer, ${time}`;
  return `${format(when, 'd MMM', { locale: es })}, ${time}`;
}

function toLocalInput(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function QuickAddSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();

  const [mode, setMode] = useState<Mode>('form');
  const [options, setOptions] = useState<Options | null>(null);
  const [memory, setMemory] = useState<QuickAddMemory | null>(null);

  const [accion, setAccion] = useState<Accion>('Gasto');
  const [amount, setAmount] = useState('');
  const [que, setQue] = useState('');
  const [tipo, setTipo] = useState('');
  const [plataforma, setPlataforma] = useState('');
  const [quien, setQuien] = useState('Yo');
  const [when, setWhen] = useState<Date | null>(null);
  const [nota, setNota] = useState('');
  const [showNota, setShowNota] = useState(false);
  const [adding, setAdding] = useState<'tipo' | 'plataforma_pago' | null>(null);
  const [draft, setDraft] = useState('');
  const [queFocused, setQueFocused] = useState(false);
  const [flash, setFlash] = useState<Field | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queRef = useRef<HTMLInputElement>(null);
  const tipoRef = useRef<HTMLDivElement>(null);
  const plataformaRef = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLDivElement>(null);

  // Reset to a fresh record every time the sheet opens, with the last-used
  // choices preselected so the common case is: amount, qué, save.
  useEffect(() => {
    if (!open) return;
    const mem = loadMemory();
    /* eslint-disable react-hooks/set-state-in-effect -- reset on open */
    setMemory(mem);
    setMode('form');
    setAccion((mem.accion as Accion | undefined) ?? 'Gasto');
    setAmount('');
    setQue('');
    setTipo(mem.recentTipos[0] ?? '');
    setPlataforma(mem.plataforma_pago ?? '');
    setQuien(mem.quien ?? 'Yo');
    setWhen(null);
    setNota('');
    setShowNota(false);
    setAdding(null);
    setError(null);
    setFlash(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  // Options are fetched once per page load, on first open.
  useEffect(() => {
    if (!open || options) return;
    let cancelled = false;
    fetch('/api/options')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data: Partial<Options> | null) => {
        if (cancelled) return;
        setOptions({
          hints: data?.hints ?? null,
          tipo: data?.tipo ?? [],
          que: data?.que ?? [],
          plataforma_pago: data?.plataforma_pago ?? [],
          quien: data?.quien?.length ? data.quien : ['Yo'],
        });
      })
      .catch(() => {
        if (!cancelled)
          setOptions({
            hints: null,
            tipo: [],
            que: [],
            plataforma_pago: [],
            quien: ['Yo'],
          });
      });
    return () => {
      cancelled = true;
    };
  }, [open, options]);

  const tipoAccion = options?.hints?.tipoAccion;

  // Categories that belong to the selected action come first, so "Salario"
  // does not sit at the front of the row while recording an expense.
  const tipos = useMemo(() => {
    const all = orderOptions(
      [tipo, ...(memory?.recentTipos ?? [])].filter(Boolean),
      options?.tipo ?? [],
    );
    if (!tipoAccion) return all;
    const fits = (t: string) => !tipoAccion[t] || tipoAccion[t] === accion;
    return [...all.filter(fits), ...all.filter((t) => !fits(t))];
  }, [accion, memory, options, tipo, tipoAccion]);
  const plataformas = useMemo(
    () =>
      orderOptions(
        [plataforma, ...(memory?.recentPlataformas ?? [])].filter(Boolean),
        options?.plataforma_pago ?? [],
      ),
    [memory, options, plataforma],
  );
  const queSuggestions = useMemo(() => {
    const q = que.trim().toLowerCase();
    const all = options?.que ?? [];
    const list = q
      ? all.filter((v) => v.toLowerCase().includes(q) && v.toLowerCase() !== q)
      : all;
    return list.slice(0, 8);
  }, [options, que]);

  const value = parseAmount(amount);
  const missing: Field | null =
    value <= 0
      ? 'cantidad'
      : !que.trim()
        ? 'que'
        : !tipo
          ? 'tipo'
          : !plataforma
            ? 'plataforma_pago'
            : null;
  const split = shouldSplitTransaction(plataforma, nota, accion);

  const applyQue = useCallback(
    (next: string) => {
      setQue(next);
      // This device's last save wins; otherwise fall back to history.
      const key = next.trim().toLowerCase();
      const hit = memory?.byQue[key] ?? options?.hints?.byQue[key];
      if (hit) {
        setTipo(hit.tipo);
        setPlataforma(hit.plataforma_pago);
      }
    },
    [memory, options],
  );

  const chooseAccion = useCallback(
    (next: Accion) => {
      setAccion(next);
      // A category that belongs to another action is almost certainly wrong
      // now; clearing it makes the save button ask for one again.
      if (tipo && tipoAccion?.[tipo] && tipoAccion[tipo] !== next) setTipo('');
    },
    [tipo, tipoAccion],
  );

  const press = useCallback((key: string) => {
    setError(null);
    setAmount((prev) => {
      if (key === 'back') return prev.slice(0, -1);
      if (key === ',') {
        if (prev.includes(',')) return prev;
        return prev ? `${prev},` : '0,';
      }
      const [int, dec] = prev.split(',') as [string, string?];
      if (dec !== undefined) return dec.length >= 2 ? prev : prev + key;
      if (int === '0') return key;
      if (int.length >= MAX_INT_DIGITS) return prev;
      return prev + key;
    });
  }, []);

  const pointAt = useCallback((field: Field) => {
    setFlash(field);
    window.setTimeout(() => setFlash(null), 900);
    if (field === 'que') queRef.current?.focus();
    const el =
      field === 'tipo'
        ? tipoRef.current
        : field === 'plataforma_pago'
          ? plataformaRef.current
          : field === 'cantidad'
            ? amountRef.current
            : null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const save = useCallback(async () => {
    if (saving) return;
    if (missing) {
      pointAt(missing);
      return;
    }
    if (!session?.user.id) {
      setError('Tu sesión ha caducado. Vuelve a iniciar sesión.');
      return;
    }
    setSaving(true);
    setError(null);
    const fecha = (when ?? new Date()).toISOString();
    const cantidad = split ? value / 2 : value;
    try {
      await createEntry(
        {
          fecha,
          accion,
          tipo,
          que: que.trim(),
          plataforma_pago: plataforma,
          cantidad,
          detalle1: nota.trim(),
          detalle2: '',
          quien,
        },
        { user: { id: session.user.id } },
      );
      rememberSave({ accion, tipo, que, plataforma_pago: plataforma, quien });
      // The new qué/category/platform should be selectable next time.
      setOptions(null);
      onClose();
      toast({
        title: SAVED_TITLE[accion],
        description: `${que.trim()} · ${formatCurrency(value)}`,
      });
      router.refresh();
    } catch {
      setError(
        'No se ha podido guardar. Revisa tu conexión e inténtalo otra vez.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    accion,
    missing,
    nota,
    onClose,
    plataforma,
    pointAt,
    que,
    quien,
    router,
    saving,
    session,
    split,
    tipo,
    value,
    when,
  ]);

  // Hardware keyboard: digits go to the amount unless a text field has focus.
  useEffect(() => {
    if (!open || mode !== 'form') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) {
        if (e.key === 'Enter' && t.tagName === 'INPUT') {
          e.preventDefault();
          void save();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === ',' || e.key === '.') press(',');
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') {
        e.preventDefault();
        void save();
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, press, save]);

  const commitDraft = () => {
    const v = draft.trim();
    if (v) {
      if (adding === 'tipo') setTipo(v);
      if (adding === 'plataforma_pago') setPlataforma(v);
    }
    setDraft('');
    setAdding(null);
  };

  const shown = displayAmount(amount);
  const quienes = options?.quien ?? ['Yo'];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-[var(--scrim)] animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'glass-sheet fixed z-[61] flex flex-col overflow-hidden text-foreground outline-none',
            'inset-x-0 bottom-0 max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] rounded-t-[28px] border-t border-hairline-strong animate-sheet-in',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:border sm:[animation:pop-in_200ms_ease-out]',
          )}
        >
          {/* Grabber in its own band, clear of the header controls. */}
          <div
            aria-hidden
            className="flex h-4 shrink-0 justify-center pt-2 sm:h-2 sm:pt-0"
          >
            <span className="h-[5px] w-10 rounded-full bg-surface-4 sm:hidden" />
          </div>

          {/* Header: close, when, who, and the two auto-fill shortcuts. */}
          <div className="flex h-12 shrink-0 items-center gap-2 px-4">
            {mode === 'form' ? (
              <DialogPrimitive.Close
                aria-label="Cerrar"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3 text-subtle transition active:scale-95"
              >
                <X className="h-[18px] w-[18px]" />
              </DialogPrimitive.Close>
            ) : (
              <button
                type="button"
                onClick={() => setMode('form')}
                aria-label="Volver"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3 text-subtle transition active:scale-95"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <DialogPrimitive.Title
              className={cn(
                'text-[15px] font-semibold tracking-[-0.01em]',
                mode === 'form' ? 'sr-only' : 'flex-1 self-center pt-1',
              )}
            >
              {mode === 'form'
                ? 'Nuevo registro'
                : mode === 'ai'
                  ? 'Escribir con IA'
                  : 'Foto de recibo'}
            </DialogPrimitive.Title>
            {mode === 'form' && (
              <>
                <div className="flex min-w-0 flex-1 gap-1.5">
                  <label className="relative flex h-10 min-w-0 cursor-pointer items-center gap-1.5 rounded-full bg-surface-3 pl-3 pr-2.5 text-[13px] font-semibold">
                    <CalendarClock className="h-4 w-4 shrink-0 text-subtle" />
                    <span className="truncate">{whenLabel(when)}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
                    <input
                      type="datetime-local"
                      aria-label="Fecha y hora"
                      value={toLocalInput(when ?? new Date())}
                      onChange={(e) => {
                        const d = new Date(e.target.value);
                        setWhen(Number.isNaN(d.getTime()) ? null : d);
                      }}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                  <label className="relative flex h-10 min-w-0 cursor-pointer items-center gap-1.5 rounded-full bg-surface-3 pl-3 pr-2.5 text-[13px] font-semibold">
                    <UserRound className="h-4 w-4 shrink-0 text-subtle" />
                    <span className="truncate">{quien}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
                    <select
                      aria-label="Quién"
                      value={quien}
                      onChange={(e) => setQuien(e.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    >
                      {orderOptions([quien], quienes).map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => setMode('ai')}
                  aria-label="Escribir con IA"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-bold tracking-[0.02em] text-subtle transition hover:text-foreground active:scale-95"
                >
                  IA
                </button>
                <button
                  type="button"
                  onClick={() => setMode('receipt')}
                  aria-label="Foto de recibo"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-3 text-subtle transition hover:text-foreground active:scale-95"
                >
                  <Camera className="h-[18px] w-[18px]" />
                </button>
              </>
            )}
          </div>

          {mode === 'ai' && (
            <div className="space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2">
              <p className="text-sm text-subtle">
                Escribe como hablas. Lo revisarás antes de guardar.
              </p>
              <QuickEntryBar />
            </div>
          )}

          {mode === 'receipt' && (
            <div className="space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2">
              <p className="text-sm text-subtle">
                Haz una foto del ticket. Leemos el importe, el comercio y la
                fecha, y lo revisas antes de guardar.
              </p>
              <ReceiptUpload />
            </div>
          )}

          {mode === 'form' && (
            <>
              <div className="no-scrollbar flex-1 overflow-y-auto px-4 pt-1">
                {/* Gasto / Ingreso / Inversión */}
                <div
                  role="radiogroup"
                  aria-label="Tipo de movimiento"
                  className="grid h-10 grid-cols-3 rounded-[13px] bg-surface-3 p-[3px]"
                >
                  {ACCIONES.map(({ value: v, icon: Icon }) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={accion === v}
                      onClick={() => chooseAccion(v)}
                      className={cn(
                        'flex items-center justify-center gap-1.5 rounded-[10px] text-[14px] font-semibold tracking-[-0.01em] transition-colors',
                        accion === v
                          ? 'bg-foreground text-background'
                          : 'text-subtle',
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.2} />
                      {v}
                    </button>
                  ))}
                </div>

                {/* Amount */}
                <div
                  ref={amountRef}
                  aria-live="polite"
                  aria-label={`Importe ${shown.int}${shown.dec} euros`}
                  className={cn(
                    'mt-1 flex h-[64px] items-center justify-center rounded-2xl transition-colors',
                    flash === 'cantidad' && 'bg-negative/10',
                  )}
                >
                  <span
                    className={cn(
                      'display-num text-[56px] font-semibold',
                      !amount && 'text-faint',
                    )}
                  >
                    {shown.int}
                    <span className={cn(!shown.dec && 'hidden')}>
                      {shown.dec}
                    </span>
                  </span>
                  <span className="mx-1.5 h-11 w-[3px] rounded-full bg-primary motion-safe:animate-pulse" />
                  <span className="self-end pb-2 text-[30px] font-medium text-subtle">
                    €
                  </span>
                </div>
                {split && value > 0 && (
                  <p className="-mt-1 mb-1 text-center text-xs text-subtle">
                    Gasto compartido: se guardará tu mitad,{' '}
                    {formatCurrency(value / 2)}
                  </p>
                )}

                {/* Qué, with the optional note tucked inside */}
                <div
                  className={cn(
                    'mt-1 flex h-12 items-center gap-3 rounded-[14px] border bg-surface-3 pl-4 pr-1.5 transition-colors',
                    flash === 'que'
                      ? 'border-negative/70'
                      : 'border-hairline focus-within:border-hairline-strong',
                  )}
                >
                  <label
                    htmlFor="quick-que"
                    className="w-8 shrink-0 text-[13px] text-subtle"
                  >
                    Qué
                  </label>
                  <input
                    id="quick-que"
                    ref={queRef}
                    value={que}
                    onChange={(e) => applyQue(e.target.value)}
                    onFocus={() => setQueFocused(true)}
                    onBlur={() =>
                      window.setTimeout(() => setQueFocused(false), 120)
                    }
                    placeholder="Mercadona, cena, gasolina…"
                    autoComplete="off"
                    enterKeyHint="done"
                    maxLength={255}
                    className="min-w-0 flex-1 bg-transparent text-base font-semibold tracking-[-0.01em] outline-none placeholder:font-normal placeholder:text-faint"
                  />
                  {que && (
                    <button
                      type="button"
                      aria-label="Borrar qué"
                      onClick={() => {
                        setQue('');
                        queRef.current?.focus();
                      }}
                      className="grid h-9 w-9 place-items-center rounded-full text-faint"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNota((s) => !s)}
                    aria-pressed={showNota}
                    aria-label="Añadir nota"
                    className={cn(
                      'grid h-9 w-9 place-items-center rounded-[10px] transition-colors',
                      showNota || nota
                        ? 'bg-surface-4 text-foreground'
                        : 'text-faint',
                    )}
                  >
                    <NotebookPen className="h-4 w-4" />
                  </button>
                </div>
                {queFocused && queSuggestions.length > 0 && (
                  <div className="rail -mx-4 mt-2 px-4">
                    {queSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          applyQue(s);
                          queRef.current?.blur();
                        }}
                        className="h-9 shrink-0 rounded-full bg-surface-4 px-3.5 text-[13px] font-semibold"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {showNota && (
                  <input
                    aria-label="Nota"
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Nota opcional"
                    maxLength={255}
                    className="mt-2 h-11 w-full rounded-[14px] border border-hairline bg-surface-3 px-4 text-[15px] outline-none placeholder:text-faint focus:border-hairline-strong"
                  />
                )}

                {/* Categoría */}
                <ChipRow
                  label="Categoría"
                  innerRef={tipoRef}
                  flashing={flash === 'tipo'}
                  loading={!options}
                  adding={adding === 'tipo'}
                  draft={draft}
                  onDraft={setDraft}
                  onCommit={commitDraft}
                  onAdd={() => {
                    setDraft('');
                    setAdding('tipo');
                  }}
                >
                  {tipos.map((t) => (
                    <Chip
                      key={t}
                      selected={t === tipo}
                      onClick={() => setTipo(t)}
                    >
                      <CategoryTile name={t} size="sm" />
                      {t}
                    </Chip>
                  ))}
                </ChipRow>

                {/* Pago */}
                <ChipRow
                  label={accion === 'Ingreso' ? 'Cobro' : 'Pago'}
                  innerRef={plataformaRef}
                  flashing={flash === 'plataforma_pago'}
                  loading={!options}
                  adding={adding === 'plataforma_pago'}
                  draft={draft}
                  onDraft={setDraft}
                  onCommit={commitDraft}
                  onAdd={() => {
                    setDraft('');
                    setAdding('plataforma_pago');
                  }}
                >
                  {plataformas.map((p) => {
                    const Icon = paymentIcon(p);
                    return (
                      <Chip
                        key={p}
                        selected={p === plataforma}
                        onClick={() => setPlataforma(p)}
                      >
                        <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-surface-4 text-subtle">
                          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                        {p}
                      </Chip>
                    );
                  })}
                </ChipRow>

                {/* Keypad */}
                <div className="mt-3 grid grid-cols-3 gap-1.5 pb-1">
                  {[
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                    '6',
                    '7',
                    '8',
                    '9',
                    ',',
                    '0',
                    'back',
                  ].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => press(k)}
                      aria-label={
                        k === 'back' ? 'Borrar' : k === ',' ? 'Coma decimal' : k
                      }
                      className="grid h-[52px] place-items-center rounded-2xl bg-surface-3 text-[26px] font-medium tracking-[-0.02em] transition-[background-color,transform] duration-100 active:scale-[0.96] active:bg-surface-4 [@media(max-height:820px)]:h-12 [@media(max-height:720px)]:h-11"
                    >
                      {k === 'back' ? (
                        <Delete
                          className="h-6 w-6 text-subtle"
                          strokeWidth={1.75}
                        />
                      ) : k === ',' ? (
                        // The comma glyph sits on the baseline; lift it to
                        // the optical centre like the digits.
                        <span className="-translate-y-1.5">,</span>
                      ) : (
                        k
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2">
                {error && (
                  <p
                    role="alert"
                    className="mb-2 text-center text-sm text-negative"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className={cn(
                    'flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-[17px] font-bold [@media(max-height:720px)]:h-[52px] tracking-[-0.02em] transition-[background-color,transform] active:scale-[0.98]',
                    missing
                      ? 'bg-surface-4 text-subtle'
                      : 'bg-primary text-primary-foreground',
                  )}
                >
                  {saving ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : missing ? (
                    <>Falta: {FIELD_LABEL[missing]}</>
                  ) : (
                    <>
                      <Check className="h-5 w-5" strokeWidth={2.6} />
                      {SAVE_VERB[accion]}
                      <span className="h-1 w-1 rounded-full bg-current opacity-40" />
                      <span className="num">{formatCurrency(value)}</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex h-11 shrink-0 items-center gap-2 rounded-[14px] border pl-2 pr-3.5 text-[14px] font-semibold tracking-[-0.01em] transition-colors [@media(max-height:700px)]:h-10',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-hairline bg-surface-3',
      )}
    >
      {children}
    </button>
  );
}

function ChipRow({
  label,
  innerRef,
  flashing,
  loading,
  adding,
  draft,
  onDraft,
  onCommit,
  onAdd,
  children,
}: {
  label: string;
  innerRef: React.Ref<HTMLDivElement>;
  flashing: boolean;
  loading: boolean;
  adding: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onCommit: () => void;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div ref={innerRef} className="mt-2.5">
      {adding ? (
        <div className="flex gap-2">
          <input
            autoFocus
            aria-label={`Añadir ${label.toLowerCase()}`}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                onCommit();
              }
            }}
            maxLength={255}
            placeholder="Escribe un nombre"
            className="h-11 min-w-0 flex-1 rounded-[14px] border border-hairline-strong bg-surface-3 px-4 text-[15px] outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={onCommit}
            className="h-11 rounded-[14px] bg-foreground px-4 text-sm font-semibold text-background"
          >
            Usar
          </button>
        </div>
      ) : (
        <div
          role="group"
          aria-label={label}
          className="-mr-4 flex items-center"
        >
          {/* Pinned outside the scroller so it never slides away. */}
          <span
            aria-hidden
            className={cn(
              'w-[64px] shrink-0 text-[12px] font-medium leading-tight transition-colors',
              flashing ? 'text-negative' : 'text-subtle',
            )}
          >
            {label}
          </span>
          <div className="rail rail-end min-w-0 flex-1 py-0.5 pr-4">
            {loading
              ? [0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-11 w-28 shrink-0 animate-pulse rounded-[14px] bg-surface-3"
                  />
                ))
              : children}
            <button
              type="button"
              onClick={onAdd}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-[14px] border border-dashed border-hairline-strong px-3.5 text-[14px] font-medium text-subtle"
            >
              <Plus className="h-4 w-4" />
              Otra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
