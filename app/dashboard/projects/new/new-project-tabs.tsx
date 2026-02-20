"use client";

import { Globe, Type, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInputClient } from "./text-input-client";
import { UploadClient } from "./upload-client";
import { UrlInputClient } from "./url-input-client";

export function NewProjectTabs() {
  const [tab, setTab] = useState<"upload" | "text" | "url">("upload");

  return (
    <div className="w-full max-w-lg space-y-4">
      <div className="flex gap-1 p-1 bg-muted">
        <Button
          variant={tab === "upload" ? "default" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => setTab("upload")}
          data-testid="tab-upload"
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          Upload File
        </Button>
        <Button
          variant={tab === "text" ? "default" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => setTab("text")}
          data-testid="tab-text"
        >
          <Type className="h-3.5 w-3.5 mr-1" />
          Text Input
        </Button>
        <Button
          variant={tab === "url" ? "default" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => setTab("url")}
          data-testid="tab-url"
        >
          <Globe className="h-3.5 w-3.5 mr-1" />
          URL
        </Button>
      </div>
      {tab === "upload" ? (
        <UploadClient />
      ) : tab === "text" ? (
        <TextInputClient />
      ) : (
        <UrlInputClient />
      )}
    </div>
  );
}
