import { AuthGate } from "@/components/AuthGate";
import { NavShell } from "@/components/NavShell";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <NavShell>{children}</NavShell>
    </AuthGate>
  );
}
