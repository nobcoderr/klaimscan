"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        style: {
          background: "#15191C",
          color: "#F3F4F5",
          border: "1px solid #2A3238",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
