"use client";

import React, { useRef, useEffect } from "react";

export function RichHTMLEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div className="border border-zinc-700 rounded overflow-hidden">
      <div className="bg-zinc-800 border-b border-zinc-700 p-2 flex gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => document.execCommand("bold")}
          className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => document.execCommand("italic")}
          className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => document.execCommand("underline")}
          className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
          title="Underline (Ctrl+U)"
        >
          <u>U</u>
        </button>
        <div className="w-px bg-zinc-600 mx-1"></div>
        <button
          type="button"
          onClick={() => {
            const url = prompt("Enter URL:");
            if (url) document.execCommand("createLink", false, url);
          }}
          className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
          title="Insert Link"
        >
          🔗
        </button>
        <button
          type="button"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = (e: any) => {
              const file = e.target.files[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  document.execCommand(
                    "insertImage",
                    false,
                    event.target?.result as string
                  );
                };
                reader.readAsDataURL(file);
              }
            };
            input.click();
          }}
          className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-xs"
          title="Insert Image"
        >
          🖼️
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={(e) => onChange(e.currentTarget.innerHTML)}
        onPaste={(e) => {
          const items = e.clipboardData.items;
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
              e.preventDefault();
              const blob = items[i].getAsFile();
              if (blob) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const img = `<img src="${event.target?.result}" style="max-width: 100%; height: auto;" />`;
                  document.execCommand("insertHTML", false, img);
                };
                reader.readAsDataURL(blob);
              }
              break;
            }
          }
        }}
        className="w-full min-h-[100px] px-3 py-2 bg-zinc-900 text-white text-sm outline-none"
        style={{ wordWrap: "break-word", overflowWrap: "break-word" }}
      />
      <p className="text-xs text-zinc-500 px-2 py-1">
        💡 Bạn có thể dán hình ảnh trực tiếp (Ctrl+V) hoặc dùng nút 🖼️
      </p>
    </div>
  );
}
