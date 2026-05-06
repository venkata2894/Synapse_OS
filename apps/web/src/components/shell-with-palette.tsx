"use client";

import * as React from "react";
import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";

export function ShellWithPalette({
  children,
  headerActions,
}: {
  children: React.ReactNode;
  headerActions: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  return (
    <>
      <AppShell headerActions={headerActions} onOpenCommand={() => setPaletteOpen(true)}>
        {children}
      </AppShell>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </>
  );
}
