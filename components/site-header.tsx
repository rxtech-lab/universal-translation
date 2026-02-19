import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) items-center gap-2 px-4">
      <SidebarTrigger className="-ml-1" />
    </header>
  );
}
