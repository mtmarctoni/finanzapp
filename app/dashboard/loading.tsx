import {
  DashboardBodySkeleton,
  DashboardHeaderSkeleton,
} from '@/components/dashboard/dashboard-skeleton';

export default function Loading() {
  return (
    <>
      <DashboardHeaderSkeleton />
      <DashboardBodySkeleton />
    </>
  );
}
