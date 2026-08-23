"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      onClick={() => window.print()}
      size="sm"
      className="flex items-center gap-2 bg-primary text-primary-foreground"
    >
      <Printer className="h-4 w-4" />
      Cetak Sekarang
    </Button>
  );
}
