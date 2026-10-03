'use client';

import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import {
  RecordDetail,
  RecordDetailPanel,
} from '@/components/recurring/record-detail-panel';
import { RecordForm } from '@/components/recurring/record-form';
import {
  GenerateCard,
  RecordsControls,
} from '@/components/recurring/records-controls';
import { RecordsList } from '@/components/recurring/records-list';
import { SummaryCards } from '@/components/recurring/summary-cards';
import {
  INITIAL_RECURRING_FORM,
  type FilterState,
  type RecurringFormData,
  type SortState,
} from '@/components/recurring/types';
import { useIsWide } from '@/components/recurring/use-is-wide';
import { useRecurringRecords } from '@/components/recurring/use-recurring-records';
import {
  calculateMonthlyCommitted,
  calculateMonthlyEstimate,
  calculateMonthlyIncome,
  nextOccurrence,
} from '@/components/recurring/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { type RecurringRecord } from '@/types/finance';

export default function RecurringRecords() {
  const {
    recurringRecords,
    loading,
    addRecord,
    updateRecord,
    deleteRecord,
    generateRecords,
  } = useRecurringRecords();
  const { toast } = useToast();

  const [formData, setFormData] = useState<RecurringFormData>(
    INITIAL_RECURRING_FORM,
  );
  const [editingRecord, setEditingRecord] = useState<RecurringRecord | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<FilterState>('all');
  const [sortBy, setSortBy] = useState<SortState>('day');
  const [search, setSearch] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [generateDate, setGenerateDate] = useState(new Date());
  const [detailOpen, setDetailOpen] = useState(false);
  const isWide = useIsWide();

  const resetForm = () => {
    setEditingRecord(null);
    setFormData(INITIAL_RECURRING_FORM);
  };

  useEffect(() => {
    // Use a microtask to avoid setting state synchronously in effect body
    if (!recurringRecords.length) {
      queueMicrotask(() => setSelectedRecordId(null));
      return;
    }

    const selectedExists = recurringRecords.some(
      (record) => record.id === selectedRecordId,
    );
    if (!selectedExists) {
      queueMicrotask(() =>
        setSelectedRecordId(recurringRecords[0]?.id ?? null),
      );
    }
  }, [recurringRecords, selectedRecordId]);

  const validateForm = () => {
    if (
      !formData.name ||
      !formData.amount ||
      !formData.accion ||
      !formData.tipo
    ) {
      toast({
        title: 'Datos incompletos',
        description:
          'Completa nombre, acción, categoría y monto para crear el registro.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const handleAddRecord = async () => {
    if (!validateForm()) return;

    const ok = await addRecord(formData);
    if (ok) {
      resetForm();
      setFormOpen(false);
    }
  };

  const handleEditRecord = (record: RecurringRecord) => {
    setDetailOpen(false);
    setEditingRecord(record);
    setFormOpen(true);
    setFormData({
      name: record.name,
      accion: record.accion,
      tipo: record.tipo || '',
      detalle1: record.detalle1 || '',
      detalle2: record.detalle2 || '',
      quien: record.quien || 'Yo',
      amount: String(record.amount),
      frequency: record.frequency,
      active: record.active,
      dia: record.dia,
      plataforma_pago: record.plataforma_pago,
    });
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord || !validateForm()) return;

    const ok = await updateRecord(editingRecord.id, formData);
    if (ok) {
      resetForm();
      setFormOpen(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    const ok = await deleteRecord(id);
    if (ok) setDetailOpen(false);
  };

  const handleGenerateRecords = async () => {
    await generateRecords(generateDate);
  };

  const activeRecords = recurringRecords.filter(
    (record) => record.active,
  ).length;
  const inactiveRecords = recurringRecords.length - activeRecords;
  const monthlyEstimate = useMemo(
    () => calculateMonthlyEstimate(recurringRecords),
    [recurringRecords],
  );
  const monthlyCommitted = useMemo(
    () => calculateMonthlyCommitted(recurringRecords),
    [recurringRecords],
  );
  const monthlyIncome = useMemo(
    () => calculateMonthlyIncome(recurringRecords),
    [recurringRecords],
  );
  const nextCharge = useMemo(() => {
    const upcoming = recurringRecords
      .filter((record) => record.active && record.accion !== 'Ingreso')
      .map((record) => ({
        name: record.name,
        date: nextOccurrence(record.dia),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    return upcoming[0] ?? null;
  }, [recurringRecords]);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const byFilter = recurringRecords.filter((record) => {
      if (filter === 'active') return record.active;
      if (filter === 'inactive') return !record.active;
      return true;
    });

    const bySearch = byFilter.filter((record) => {
      if (!normalizedSearch) return true;
      const content = [
        record.name,
        record.accion,
        record.tipo,
        record.plataforma_pago,
        record.detalle1,
        record.detalle2,
        record.quien,
      ]
        .join(' ')
        .toLowerCase();
      return content.includes(normalizedSearch);
    });

    return [...bySearch].sort((left, right) => {
      if (sortBy === 'name') return left.name.localeCompare(right.name);
      if (sortBy === 'amount')
        return Number(right.amount) - Number(left.amount);
      return left.dia - right.dia;
    });
  }, [filter, recurringRecords, search, sortBy]);

  const selectedRecord =
    filteredRecords.find((record) => record.id === selectedRecordId) ?? null;
  const hasActiveFilters =
    search.trim().length > 0 || filter !== 'all' || sortBy !== 'day';

  const openNewForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Recurrentes"
        eyebrow="Cargos e ingresos fijos"
        actions={
          <Button size="sm" onClick={openNewForm} className="h-10 px-4">
            <Plus />
            Nuevo
          </Button>
        }
      />

      <div className="space-y-6">
        <SummaryCards
          activeRecords={activeRecords}
          inactiveRecords={inactiveRecords}
          monthlyCommitted={monthlyCommitted}
          monthlyIncome={monthlyIncome}
          monthlyEstimate={monthlyEstimate}
          nextCharge={nextCharge}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-3">
            <h2 className="px-1 text-[17px] font-semibold tracking-[-0.02em]">
              Tus recurrentes
            </h2>
            <RecordsControls
              search={search}
              filter={filter}
              sortBy={sortBy}
              resultsCount={filteredRecords.length}
              hasActiveFilters={hasActiveFilters}
              onSearchChange={setSearch}
              onFilterChange={setFilter}
              onSortChange={setSortBy}
              onClearFilters={() => {
                setSearch('');
                setFilter('all');
                setSortBy('day');
              }}
            />
            <RecordsList
              records={filteredRecords}
              selectedRecordId={selectedRecordId}
              showSelection={isWide}
              onSelectRecord={(id) => {
                setSelectedRecordId(id);
                if (!isWide) setDetailOpen(true);
              }}
            />
          </section>

          <div className="space-y-4 lg:pt-10">
            {isWide && (
              <RecordDetailPanel
                record={selectedRecord}
                loading={loading}
                onEdit={handleEditRecord}
                onDelete={handleDeleteRecord}
              />
            )}
            <GenerateCard
              loading={loading}
              generateDate={generateDate}
              onGenerateDateChange={setGenerateDate}
              onGenerateRecords={handleGenerateRecords}
            />
          </div>
        </div>
      </div>

      <Dialog
        open={!isWide && detailOpen && Boolean(selectedRecord)}
        onOpenChange={setDetailOpen}
      >
        <DialogContent
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {selectedRecord && (
            <RecordDetail
              record={selectedRecord}
              loading={loading}
              onEdit={handleEditRecord}
              onDelete={handleDeleteRecord}
              titleAs={DialogTitle}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}
      >
        <DialogContent
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="sm:max-w-xl"
        >
          <DialogTitle className="sr-only">
            {editingRecord ? 'Editar recurrente' : 'Nuevo recurrente'}
          </DialogTitle>
          <RecordForm
            formData={formData}
            loading={loading}
            isEditing={Boolean(editingRecord)}
            onChange={setFormData}
            onCancel={closeForm}
            onSubmit={editingRecord ? handleUpdateRecord : handleAddRecord}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
