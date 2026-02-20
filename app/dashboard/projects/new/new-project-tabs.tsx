"use client";

import { Type, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInputClient } from "./text-input-client";
import { UploadClient } from "./upload-client";

export function NewProjectTabs() {
  const [tab, setTab] = useState<"upload" | "text">("upload");

  return (
    <div className="w-full max-w-lg space-y-4">
      <div className="flex gap-1 p-1 bg-muted">
        <Button
          variant={tab === "upload" ? "default" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => setTab("upload")}
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          Upload File
        </Button>
        <Button
          variant={tab === "text" ? "default" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => setTab("text")}
        >
          <Type className="h-3.5 w-3.5 mr-1" />
          Text Input
        </Button>
      </div>
      {tab === "upload" ? <UploadClient /> : <TextInputClient />}
    </div>
  );
}
