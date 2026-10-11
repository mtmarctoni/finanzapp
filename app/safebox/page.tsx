import { PageHeader } from '@/components/page-header';
import { SafeboxFormSheet } from '@/components/safebox/safebox-form-sheet';
import { SafeboxHistory } from '@/components/safebox/safebox-history';
import { SafeboxOverview } from '@/components/safebox/safebox-overview';

export const metadata = {
  title: 'Caja fuerte | FinanzApp',
  description:
    'Controla el efectivo de tu caja fuerte: saldo esperado, ingresos, retiradas y recuentos',
};

export default function SafeboxPage() {
  return (
    <>
      <PageHeader title="Caja fuerte" eyebrow="Efectivo" />

      <div className="space-y-8">
        <SafeboxOverview />
        <SafeboxHistory />
      </div>

      <SafeboxFormSheet />
    </>
  );
}
