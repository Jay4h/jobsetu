import { useEffect, useMemo, useRef, useState } from "react";

export default function SearchBar({
  onSubmit,
  initialQ = "",
}: {
  onSubmit: (q: string) => void;
  initialQ?: string;
}) {
  const [q, setQ] = useState(initialQ);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Static type-ahead suggestions
  const SUGGESTIONS = useMemo(
    () => [
      "React developer",
      "Node.js",
      "C# .NET",
      "ASP.NET Core",
      "Java backend",
      "Python data analyst",
      "SQL developer",
      "UI/UX designer",
      "Android developer",
      "iOS Swift",
      "DevOps engineer",
      "QA automation",
      "Business analyst",
      "Power BI",
    ],
    []
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return SUGGESTIONS.filter((x) => x.toLowerCase().includes(s)).slice(0, 6);
  }, [q, SUGGESTIONS]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    onSubmit(q);
  }

  function choose(text: string) {
    setQ(text);
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && filtered.length > 0 && (e.key === "ArrowDown" || e.key === "Enter")) setOpen(true);
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((p) => (p + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((p) => (p - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0) choose(filtered[active]);
      else handleSubmit();
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const pills = ["React developer", "Node.js", "C# .NET", "Data Analyst"];

  return (
    <form onSubmit={handleSubmit} className="mt-6 p-3 glass rounded-2xl shadow-soft">
      <div className="flex gap-3 items-stretch" ref={wrapRef}>
        {/* keyword with suggestions */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            className="input"
            placeholder="Search jobs, e.g., React developer"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => filtered.length > 0 && setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {open && filtered.length > 0 && (
            <div className="absolute z-30 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
              {filtered.map((s, i) => (
                <button
                  type="button"
                  key={s}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-colors ${
                    i === active ? "bg-primary-50 text-primary-700" : ""
                  }`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* simple search button */}
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </div>

      {/* quick suggestion pills */}
      <div className="flex flex-wrap gap-2 mt-3">
        {pills.map((p) => (
          <button
            key={p}
            type="button"
            className="badge badge-primary hover:bg-primary-200 transition-colors"
            onClick={() => setQ(p)}
            title={`Use "${p}"`}
          >
            {p}
          </button>
        ))}
      </div>
    </form>
  );
}

export { SearchBar };



