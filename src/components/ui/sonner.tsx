"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        style: {
          background: "#0D2133",
          color: "#F3F8FF",
          border: "1px solid #254159",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
