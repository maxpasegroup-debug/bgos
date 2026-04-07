"use client";

import { useCallback, useEffect, useState } from "react";
import { IceconnectWorkspaceView } from "@/components/iceconnect/IceconnectWorkspaceView";
import { IcPanel } from "@/components/iceconnect/IcPanel";

type ProductRow = {
  id: string;
  name: string;
  category: string;
  unit: string;
};
type StockRow = {
  id: string;
  productId: string;
  productName: string;
  category: string;
  unit: string;
  quantity: number;
  low: boolean;
};
type LogRow = {
  id: string;
  productName: string;
  type: string;
  quantity: number;
  reference: string;
  createdAt: string;
};

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[color:var(--ice-primary)]";

export function IceconnectInventoryDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Panel");
  const [unit, setUnit] = useState("pcs");

  const [stockProductId, setStockProductId] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [stockRef, setStockRef] = useState("purchase");

  const [useProductId, setUseProductId] = useState("");
  const [useQty, setUseQty] = useState("");
  const [useRef, setUseRef] = useState("installation");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch("/api/inventory/product/list", { credentials: "include" }),
        fetch("/api/inventory/stock/list", { credentials: "include" }),
      ]);
      const pj = (await pRes.json()) as { ok?: boolean; products?: ProductRow[]; error?: string };
      const sj = (await sRes.json()) as {
        ok?: boolean;
        stock?: StockRow[];
        logs?: LogRow[];
        error?: string;
      };
      if (!pRes.ok || !pj.ok || !Array.isArray(pj.products)) {
        setError(pj.error ?? "Could not load products");
        return;
      }
      if (!sRes.ok || !sj.ok || !Array.isArray(sj.stock)) {
        setError(sj.error ?? "Could not load stock");
        return;
      }
      setProducts(pj.products);
      setStock(sj.stock);
      setLogs(Array.isArray(sj.logs) ? sj.logs : []);
      if (pj.products.length > 0) {
        if (!stockProductId) setStockProductId(pj.products[0].id);
        if (!useProductId) setUseProductId(pj.products[0].id);
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [stockProductId, useProductId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProduct() {
    const res = await fetch("/api/inventory/product/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, unit }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not create product");
      return;
    }
    setName("");
    await load();
  }

  async function addStock() {
    const quantity = Number(stockQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter valid stock quantity.");
      return;
    }
    const res = await fetch("/api/inventory/stock/add", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: stockProductId, quantity, reference: stockRef }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not add stock");
      return;
    }
    setStockQty("");
    await load();
  }

  async function consumeStock() {
    const quantity = Number(useQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter valid usage quantity.");
      return;
    }
    const res = await fetch("/api/inventory/stock/use", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: useProductId, quantity, reference: useRef }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not use stock");
      return;
    }
    setUseQty("");
    await load();
  }

  const low = stock.filter((s) => s.low);

  return (
    <IceconnectWorkspaceView
      title="Inventory Management"
      subtitle="Add products, track stock, and issue materials for installations."
      loading={loading}
      error={error}
      onRetry={() => void load()}
    >
      <div className="grid gap-6">
        <IcPanel title="Add product">
          <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
            <label className="text-xs text-gray-500 sm:col-span-2">
              Name
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-xs text-gray-500">
              Category
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Panel</option><option>Inverter</option><option>Battery</option><option>Accessories</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Unit
              <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
            </label>
          </div>
          <button type="button" className="mt-3 rounded-lg bg-[color:var(--ice-primary)] px-3 py-2 text-sm font-semibold text-white" onClick={() => void createProduct()}>
            Add product
          </button>
        </IcPanel>

        <IcPanel title="Stock movement">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Add stock</p>
              <label className="mt-2 block text-xs text-gray-500">
                Product
                <select className={inputClass} value={stockProductId} onChange={(e) => setStockProductId(e.target.value)}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="mt-2 block text-xs text-gray-500">
                Quantity
                <input className={inputClass} value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
              </label>
              <label className="mt-2 block text-xs text-gray-500">
                Reference
                <input className={inputClass} value={stockRef} onChange={(e) => setStockRef(e.target.value)} />
              </label>
              <button type="button" className="mt-3 rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-700" onClick={() => void addStock()}>
                Add stock
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Use stock</p>
              <label className="mt-2 block text-xs text-gray-500">
                Product
                <select className={inputClass} value={useProductId} onChange={(e) => setUseProductId(e.target.value)}>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label className="mt-2 block text-xs text-gray-500">
                Quantity
                <input className={inputClass} value={useQty} onChange={(e) => setUseQty(e.target.value)} />
              </label>
              <label className="mt-2 block text-xs text-gray-500">
                Reference
                <input className={inputClass} value={useRef} onChange={(e) => setUseRef(e.target.value)} />
              </label>
              <button type="button" className="mt-3 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700" onClick={() => void consumeStock()}>
                Use stock
              </button>
            </div>
          </div>
        </IcPanel>

        <IcPanel title="Stock levels">
          {low.length > 0 ? (
            <p className="mb-3 text-sm text-red-700">Low stock alert: {low.map((x) => x.productName).join(", ")}</p>
          ) : null}
          <div className="space-y-2">
            {stock.map((s) => (
              <div key={s.id} className={`rounded-lg border p-3 text-sm ${s.low ? "border-red-300 bg-red-50" : "border-gray-200"}`}>
                <p className="font-medium text-gray-900">{s.productName} · {s.category}</p>
                <p className="text-gray-600">{s.quantity} {s.unit}</p>
              </div>
            ))}
          </div>
        </IcPanel>

        <IcPanel title="Recent stock log">
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-900">{l.productName} · {l.type} {l.quantity}</p>
                <p className="text-gray-600">{l.reference} · {new Date(l.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </IcPanel>
      </div>
    </IceconnectWorkspaceView>
  );
}
