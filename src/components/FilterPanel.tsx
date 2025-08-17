import { useEffect, useMemo, useState } from "react";

/** ===== Filters shape aligned to your backend ===== */
export type Filters = {
  // primitives / columns
  q?: string;
  location?: string;
  workMode?: "Any" | "Remote" | "Hybrid" | "On-site";
  expMin?: number;
  expMax?: number;
  salaryMin?: number;
  salaryMax?: number;
  urgent?: boolean;

  // job metadata (JobMetadata.Type / Value)
  department?: string[];
  roleCategory?: string[];
  industry?: string[];
  companyType?: string[];
  education?: string[];
  duration?: string[];
  experienceLevel?: string[];
  businessType?: string[];
  postedBy?: string[];
  topCompanies?: string[]; // convenience filter

  // time window
  postedWithin?: "1d" | "3d" | "7d" | "30d" | "any";

  // sort
  sort?: "relevance" | "newest" | "salary_desc" | "salary_asc";
};

type Options = {
  locations: string[];
  departments: string[];
  roleCategories: string[];
  industries: string[];
  companyTypes: string[];
  educations: string[];
  durations: string[];
  experienceLevels: string[];
  businessTypes: string[];
  postedBy: string[];
  topCompanies: string[];
};

export default function FilterPanel({
  value,
  options,
  onChange,
  onApply,
  onClear,
  onSaveSearch,
  savedSearches,
  onLoadSaved,
}: {
  value: Filters;
  options: Options;
  onChange: (next: Filters) => void;
  onApply: () => void;
  onClear: () => void;

  // saved searches
  onSaveSearch: (name: string, filters: Filters) => void;
  savedSearches: { name: string; filters: Filters }[];
  onLoadSaved: (name: string) => void;
}) {
  const [local, setLocal] = useState<Filters>(value);

  // keep local in sync with external value (e.g., chips removing filters)
  useEffect(() => setLocal(value), [value]);

  // toggle helper for multi-select arrays
  function toggleMulti<K extends keyof Filters>(key: K, val: string) {
    const current = (local[key] as string[] | undefined) ?? [];
    const set = new Set(current);
    set.has(val) ? set.delete(val) : set.add(val);
    const arr = Array.from(set);
    setLocal({
      ...local,
      [key]: arr.length ? arr : undefined, // keep URL compact & chips consistent
    });
  }

  // detect if there is at least one active filter to allow saving
  const canSave = useMemo(() => {
    const l = local as Record<string, any>;
    return Object.keys(l).some((k) => {
      const v = l[k];
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== null && v !== "" && !(k === "workMode" && v === "Any");
    });
  }, [local]);

  // helpers
  const applyNow = () => {
    onChange(local);
    onApply();
  };

  const clearAll = () => {
    setLocal({});
    onClear();
  };

  const resetToValue = () => {
    setLocal(value);
    onChange(value);
  };

  // submit on Enter for quick search
  const onKeyDownApply: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") applyNow();
  };

  return (
    <aside className="card p-4 lg:p-5 sticky top-20 max-h-[calc(100vh-6rem)] overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        <button
          onClick={clearAll}
          className="text-sm text-gray-600 hover:text-gray-900"
          type="button"
        >
          Clear all
        </button>
      </div>

      {/* Saved searches */}
      <div className="mt-3 flex items-center gap-2">
        <select
          className="input h-9 py-1.5 flex-1"
          defaultValue=""
          onChange={(e) => e.target.value && onLoadSaved(e.target.value)}
        >
          <option value="">Saved searches…</option>
          {savedSearches.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="btn btn-ghost h-9"
          disabled={!canSave}
          onClick={() => {
            const name = prompt("Name this search:");
            if (name) onSaveSearch(name, local);
          }}
          type="button"
        >
          Save
        </button>
      </div>

      {/* Keyword & Location */}
      <div className="mt-4 space-y-3">
        <input
          className="input"
          placeholder="Keyword"
          value={local.q || ""}
          onChange={(e) => setLocal({ ...local, q: e.target.value })}
          onKeyDown={onKeyDownApply}
        />
        <input
          className="input"
          list="loc-list"
          placeholder="Location"
          value={local.location || ""}
          onChange={(e) => setLocal({ ...local, location: e.target.value })}
          onKeyDown={onKeyDownApply}
        />
        <datalist id="loc-list">
          {(options.locations || []).map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </div>

      {/* Work mode + Urgent */}
      <div className="mt-5">
        <div className="text-sm font-medium mb-2">Work mode</div>
        <div className="segment">
          {(["Any", "Remote", "Hybrid", "On-site"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={local.workMode === m || (!local.workMode && m === "Any")}
              onClick={() => setLocal({ ...local, workMode: m })}
            >
              {m}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={!!local.urgent}
            onChange={(e) => setLocal({ ...local, urgent: e.target.checked || undefined })}
          />
          Urgent openings
        </label>
      </div>

      {/* Experience & Salary */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div>
          <div className="text-sm font-medium mb-1">Exp. min</div>
          <input
            className="input"
            type="number"
            min={0}
            value={local.expMin ?? ""}
            onChange={(e) =>
              setLocal({ ...local, expMin: e.target.value ? Number(e.target.value) : undefined })
            }
            onKeyDown={onKeyDownApply}
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Exp. max</div>
          <input
            className="input"
            type="number"
            min={0}
            value={local.expMax ?? ""}
            onChange={(e) =>
              setLocal({ ...local, expMax: e.target.value ? Number(e.target.value) : undefined })
            }
            onKeyDown={onKeyDownApply}
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Salary min (₹)</div>
          <input
            className="input"
            type="number"
            min={0}
            value={local.salaryMin ?? ""}
            onChange={(e) =>
              setLocal({
                ...local,
                salaryMin: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            onKeyDown={onKeyDownApply}
          />
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Salary max (₹)</div>
          <input
            className="input"
            type="number"
            min={0}
            value={local.salaryMax ?? ""}
            onChange={(e) =>
              setLocal({
                ...local,
                salaryMax: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            onKeyDown={onKeyDownApply}
          />
        </div>
      </div>

      {/* Department, Role Category, Industry */}
      <Picker
        title="Department"
        items={options.departments}
        active={local.department || []}
        onToggle={(v) => toggleMulti("department", v)}
        onClear={() => setLocal({ ...local, department: undefined })}
      />
      <Picker
        title="Role category"
        items={options.roleCategories}
        active={local.roleCategory || []}
        onToggle={(v) => toggleMulti("roleCategory", v)}
        onClear={() => setLocal({ ...local, roleCategory: undefined })}
      />
      <Picker
        title="Industry"
        items={options.industries}
        active={local.industry || []}
        onToggle={(v) => toggleMulti("industry", v)}
        onClear={() => setLocal({ ...local, industry: undefined })}
      />

      {/* Company attributes */}
      <Picker
        title="Company type"
        items={options.companyTypes}
        active={local.companyType || []}
        onToggle={(v) => toggleMulti("companyType", v)}
        onClear={() => setLocal({ ...local, companyType: undefined })}
      />
      <Picker
        title="Business type"
        items={options.businessTypes}
        active={local.businessType || []}
        onToggle={(v) => toggleMulti("businessType", v)}
        onClear={() => setLocal({ ...local, businessType: undefined })}
      />
      <Picker
        title="Top companies"
        items={options.topCompanies}
        active={local.topCompanies || []}
        onToggle={(v) => toggleMulti("topCompanies", v)}
        onClear={() => setLocal({ ...local, topCompanies: undefined })}
      />

      {/* Candidate/Job requirements */}
      <Picker
        title="Education"
        items={options.educations}
        active={local.education || []}
        onToggle={(v) => toggleMulti("education", v)}
        onClear={() => setLocal({ ...local, education: undefined })}
      />
      <Picker
        title="Experience level"
        items={options.experienceLevels}
        active={local.experienceLevel || []}
        onToggle={(v) => toggleMulti("experienceLevel", v)}
        onClear={() => setLocal({ ...local, experienceLevel: undefined })}
      />
      <Picker
        title="Duration"
        items={options.durations}
        active={local.duration || []}
        onToggle={(v) => toggleMulti("duration", v)}
        onClear={() => setLocal({ ...local, duration: undefined })}
      />

      {/* Posted by + time window */}
      <Picker
        title="Posted by"
        items={options.postedBy}
        active={local.postedBy || []}
        onToggle={(v) => toggleMulti("postedBy", v)}
        onClear={() => setLocal({ ...local, postedBy: undefined })}
      />

      <div className="mt-5">
        <div className="text-sm font-medium mb-2">Posted within</div>
        <div className="flex flex-wrap gap-2">
          {(["1d", "3d", "7d", "30d", "any"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`chip ${local.postedWithin === p ? "bg-gray-100" : ""}`}
              onClick={() => setLocal({ ...local, postedWithin: p })}
            >
              {p === "any" ? "Any time" : p}
            </button>
          ))}
          {!!local.postedWithin && (
            <button
              type="button"
              className="chip"
              onClick={() => setLocal({ ...local, postedWithin: undefined })}
              title="Clear time window"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="mt-6 flex gap-2">
        <button className="btn btn-primary flex-1" onClick={applyNow} type="button">
          Apply filters
        </button>
        <button className="btn btn-ghost" onClick={resetToValue} type="button">
          Reset
        </button>
      </div>
    </aside>
  );
}

/* ---------- small picker section ---------- */
function Picker({
  title,
  items,
  active,
  onToggle,
  onClear,
}: {
  title: string;
  items: string[];
  active: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  if (!items?.length) return null;
  const hasAny = active?.length > 0;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">{title}</div>
        {hasAny && (
          <button
            type="button"
            className="text-xs text-gray-600 hover:text-gray-900"
            onClick={onClear}
          >
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((d) => (
          <button
            type="button"
            key={d}
            className={`chip ${active.includes(d) ? "bg-gray-100" : ""}`}
            onClick={() => onToggle(d)}
            title={active.includes(d) ? "Remove" : "Add"}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
