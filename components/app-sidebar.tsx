"use client";

import { GlobeIcon, LayoutDashboardIcon, LogOutIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { signOutAction } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Link, usePathname } from "@/i18n/navigation";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const t = useExtracted();
  const pathname = usePathname();

  const navItems = [
    {
      title: t("Dashboard"),
      url: "/dashboard" as const,
      icon: LayoutDashboardIcon,
      exact: true,
    },
    {
      title: t("Translations"),
      url: "/dashboard/projects" as const,
      icon: GlobeIcon,
      exact: false,
    },
  ];

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center text-xs font-bold">
                  UT
                </div>
                <span className="font-semibold">
                  {t("Universal Translation")}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("Navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.exact
                        ? pathname === item.url
                        : pathname === item.url ||
                          pathname.startsWith(`${item.url}/`)
                    }
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="mb-2 ml-2">
            <LanguageSwitcher />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signOutAction}>
              <SidebarMenuButton type="submit">
                <LogOutIcon />
                <span>{t("Sign out")}</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
