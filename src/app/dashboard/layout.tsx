import MaintenanceGuard from "@/components/MaintenanceGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MaintenanceGuard />
      {children}
    </>
  );
}