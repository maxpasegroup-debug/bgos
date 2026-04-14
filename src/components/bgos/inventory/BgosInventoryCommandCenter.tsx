"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Filter = "all" | "low_stock" | "out_of_stock";
type ProductRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
  minStockLevel: number;
  currentStock: number;
  status: "IN_STOCK" | "LOW" | "OUT";
  stockUsed: number;
  remainingStock: number;
};

type InventoryData = {
  overview: {
    totalProducts: number;
    inStockItems: number;
    lowStockItems: number;
    outOfStockItems: number;
  };
  products: ProductRow[];
  usageHistory: {
    id: string;
    productId: string;
    productName: string;
    type: "IN" | "OUT";
    quantity: number;
    usedFor: "installation" | "service" | "stock";
    reference: string;
    date: string;
  }[];
  alerts: {
    productId: string;
    productName: string;
    currentStock: number;
    minStockLevel: number;
    message: string;
  }[];
  insights: { insightLines: string[]; suggestionLines: string[] };
};

function statusMeta(s: ProductRow["status"]): { label: string; cls: string; dot: string } {
  if (s === "OUT") return { label: "Out", cls: "text-red-200", dot: "bg-red-400" };
  if (s === "LOW") return { label: "Low", cls: "text-amber-200", dot: "bg-amber-400" };
  return { label: "In Stock", cls: "text-emerald-200", dot: "bg-emerald-400" };
}

function fDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function BgosInventoryCommandCenter() {
  const [filter, setFilter] = useState<Filter>("all");
  const [data, setData] = useState<InventoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productOpen, setProductOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [nexaLine, setNexaLine] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({
    name: "",
    category: "Panel",
    unit: "pcs",
    minStockLevel: "5",
  });
  const [stockForm, setStockForm] = useState({
    productId: "",
    quantity: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [useForm, setUseForm] = useState({
    quantity: "",
    usedFor: "installation" as "installation" | "service",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/bgos/inventory?filter=${encodeURIComponent(filter)}`);
      const j = (await res.json()) as { data?: InventoryData; message?: string; error?: string };
      if (!res.ok) {
        const base = j.message ?? j.error ?? "Could not load inventory.";
        setError(`${base} (HTTP ${res.status})`);
        setData(null);
      } else {
        setData(j.data ?? (j as unknown as InventoryData));
      }
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach inventory API"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => data?.products.find((p) => p.id === detailId) ?? null, [data?.products, detailId]);
  const selectedHistory = useMemo(
    () => (data?.usageHistory ?? []).filter((h) => h.productId === detailId),
    [data?.usageHistory, detailId],
  );

  async function createProduct() {
    await apiFetch("/api/bgos/inventory/product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: productForm.name,
        category: productForm.category,
        unit: productForm.unit,
        minStockLevel: Number(productForm.minStockLevel),
      }),
    });
    setProductOpen(false);
    setProductForm({ name: "", category: "Panel", unit: "pcs", minStockLevel: "5" });
    await load();
  }

  async function addStock() {
    await apiFetch("/api/bgos/inventory/stock?mode=add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: stockForm.productId,
        quantity: Number(stockForm.quantity),
        date: stockForm.date,
      }),
    });
    setStockOpen(false);
    setStockForm({ productId: "", quantity: "", date: new Date().toISOString().slice(0, 10) });
    await load();
  }

  async function useStock() {
    if (!selected) return;
    await apiFetch("/api/bgos/inventory/stock?mode=use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selected.id,
        quantity: Number(useForm.quantity),
        usedFor: useForm.usedFor,
      }),
    });
    setUseForm({ quantity: "", usedFor: "installation" });
    await load();
  }

  const noProducts = (data?.products.length ?? 0) === 0;

  return (
    <div className={`${BGOS_MAIN_PAD} w-full pb-12 pt-5`}>
      <div className="w-full">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Inventory</h1>
              <p className="mt-1 text-sm text-white/60">Manage your stock and materials</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setProductOpen(true)}
                className="rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2 text-sm font-semibold text-[#FFE08A]"
              >
                Add Product
              </button>
              <button
                type="button"
                onClick={() => setStockOpen(true)}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/85"
              >
                Add Stock
              </button>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white"
              >
                <option value="all">All</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Total products", String(data?.overview.totalProducts ?? 0)],
            ["In stock items", String(data?.overview.inStockItems ?? 0)],
            ["Low stock items", String(data?.overview.lowStockItems ?? 0)],
            ["Out of stock items", String(data?.overview.outOfStockItems ?? 0)],
          ].map(([k, v], i) => (
            <motion.div
              key={k}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{k}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{v}</p>
            </motion.div>
          ))}
        </section>

        <section className="mb-8">
          {loading && !data ? (
            <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          ) : noProducts ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <p className="text-lg font-medium text-white/90">No products added yet</p>
              <button
                type="button"
                onClick={() => setProductOpen(true)}
                className="mt-4 rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2 text-sm font-semibold text-[#FFE08A]"
              >
                Add your first product
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data?.products.map((p) => {
                const s = statusMeta(p.status);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDetailId(p.id)}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"
                  >
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    <p className="mt-1 text-xs text-white/60">
                      {p.category} · {p.unit}
                    </p>
                    <p className="mt-2 text-sm text-white/80">Current stock: {p.currentStock}</p>
                    <p className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${s.cls}`}>
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                      {s.label}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">Low stock alerts</h2>
            <div className="mt-3 space-y-2">
              {(data?.alerts ?? []).length === 0 ? (
                <p className="text-sm text-white/55">No alerts right now.</p>
              ) : (
                data?.alerts.map((a) => (
                  <div key={a.productId} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <p className="text-sm text-white">{a.message}</p>
                    <p className="text-xs text-white/60">
                      {a.productName} · {a.currentStock} (min {a.minStockLevel})
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setStockForm((s) => ({ ...s, productId: a.productId }));
                        setStockOpen(true);
                      }}
                      className="mt-2 rounded-md border border-[#FFC300]/30 px-2 py-1 text-xs text-[#FFE08A]"
                    >
                      Restock now
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">Nexa inventory insights</h2>
            <div className="mt-3 space-y-2">
              {data?.insights.insightLines.map((l) => (
                <p key={l} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                  {l}
                </p>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {data?.insights.suggestionLines.map((l) => (
                <p key={l} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
                  {l}
                </p>
              ))}
            </div>
            {nexaLine ? <p className="mt-3 text-sm text-[#FFC300]/85">{nexaLine}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setNexaLine("Restock: prioritize out-of-stock items first.")}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100"
              >
                Restock
              </button>
              <button
                type="button"
                onClick={() => setNexaLine("Auto reorder: planned for future release.")}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/85"
              >
                Auto reorder (future)
              </button>
            </div>
          </div>
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>

      {productOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F141E] p-5">
            <h3 className="text-lg font-semibold text-white">Add product</h3>
            <div className="mt-4 space-y-3">
              <input
                value={productForm.name}
                onChange={(e) => setProductForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Product name"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
              <input
                value={productForm.category}
                onChange={(e) => setProductForm((s) => ({ ...s, category: e.target.value }))}
                placeholder="Category"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
              <input
                value={productForm.unit}
                onChange={(e) => setProductForm((s) => ({ ...s, unit: e.target.value }))}
                placeholder="Unit (pcs / kW / etc.)"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
              <input
                value={productForm.minStockLevel}
                onChange={(e) => setProductForm((s) => ({ ...s, minStockLevel: e.target.value }))}
                inputMode="decimal"
                placeholder="Minimum stock level"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setProductOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80">
                Cancel
              </button>
              <button type="button" onClick={() => void createProduct()} className="rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stockOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F141E] p-5">
            <h3 className="text-lg font-semibold text-white">Add stock</h3>
            <div className="mt-4 space-y-3">
              <select
                value={stockForm.productId}
                onChange={(e) => setStockForm((s) => ({ ...s, productId: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              >
                <option value="">Select product</option>
                {data?.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                value={stockForm.quantity}
                onChange={(e) => setStockForm((s) => ({ ...s, quantity: e.target.value }))}
                inputMode="decimal"
                placeholder="Quantity"
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
              <input
                type="date"
                value={stockForm.date}
                onChange={(e) => setStockForm((s) => ({ ...s, date: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setStockOpen(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80">
                Cancel
              </button>
              <button type="button" onClick={() => void addStock()} className="rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]">
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailId && selected ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setDetailId(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0F141E] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{selected.name}</h3>
                <p className="mt-1 text-sm text-white/60">
                  {selected.category} · {selected.unit}
                </p>
              </div>
              <button type="button" onClick={() => setDetailId(null)} className="text-sm text-white/65">
                Close
              </button>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-white/85">Total stock: {selected.currentStock}</p>
              <p className="text-sm text-white/85">Stock used: {selected.stockUsed}</p>
              <p className="text-sm text-white/85">Remaining stock: {selected.remainingStock}</p>
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Use stock</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={useForm.quantity}
                  onChange={(e) => setUseForm((s) => ({ ...s, quantity: e.target.value }))}
                  inputMode="decimal"
                  placeholder="Quantity"
                  className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                />
                <select
                  value={useForm.usedFor}
                  onChange={(e) => setUseForm((s) => ({ ...s, usedFor: e.target.value as "installation" | "service" }))}
                  className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                >
                  <option value="installation">installation</option>
                  <option value="service">service</option>
                </select>
                <button type="button" onClick={() => void useStock()} className="rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]">
                  Use
                </button>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm font-semibold text-white">Usage history</p>
              <div className="mt-2 space-y-2">
                {selectedHistory.map((h) => (
                  <div key={h.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <p className="text-sm text-white">
                      {h.type} {h.quantity} · {h.usedFor}
                    </p>
                    <p className="text-xs text-white/55">
                      {h.reference} · {fDate(h.date)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
