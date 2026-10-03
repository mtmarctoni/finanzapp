import { FileDown } from 'lucide-react';
import { Suspense } from 'react';

import FinanceTable from '@/components/finance-table';
import { PageHeader } from '@/components/page-header';
import { SearchFilter } from '@/components/search-filter';
import { TableSkeleton } from '@/components/table-skeleton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_ACCION_FILTER, ITEMS_PER_PAGE } from '@/config';

export const dynamic = 'force-dynamic';

export default async function RecordsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    search?: string;
    accion?: string;
    from?: string;
    to?: string;
    page?: string;
    itemsPerPage?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const {
    search = '',
    accion = DEFAULT_ACCION_FILTER,
    from = '',
    to = '',
    page = '1',
    itemsPerPage = String(ITEMS_PER_PAGE),
    sortBy,
    sortOrder,
  } = (await searchParams) ?? {};

  const filterParams = {
    search,
    accion,
    from,
    to,
    page,
    itemsPerPage,
    ...(sortBy ? { sortBy } : {}),
    ...(sortOrder ? { sortOrder } : {}),
  };

  const exportParams = new URLSearchParams();
  if (search) exportParams.set('search', search);
  if (from) exportParams.set('from', from);
  if (to) exportParams.set('to', to);
  if (accion && accion !== 'todos') exportParams.set('tipo', accion);

  return (
    <>
      <PageHeader
        title="Registros"
        actions={
          <Button
            asChild
            variant="secondary"
            size="icon"
            className="border border-hairline"
          >
            <a
              href={`/api/export?${exportParams.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Exportar Excel"
              title="Exportar Excel"
            >
              <FileDown className="!size-[18px]" />
            </a>
          </Button>
        }
      />

      <Suspense
        fallback={<Skeleton className="mb-4 h-[104px] w-full rounded-[20px]" />}
      >
        <SearchFilter />
      </Suspense>

      <div className="pt-5 md:pt-0">
        <Suspense fallback={<TableSkeleton />}>
          <FinanceTable searchParams={filterParams} />
        </Suspense>
      </div>
    </>
  );
}
