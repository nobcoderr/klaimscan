"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        style: {
          background: "#fffcf8",
          color: "#1c2824",
          border: "1px solid #d5dfd8",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
