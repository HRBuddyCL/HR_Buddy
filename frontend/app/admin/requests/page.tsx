"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { Button, SelectField, TextField } from "@/components/ui/form-controls";
import { ApiError } from "@/lib/api/client";
import {
  downloadAdminRequestsCsv,
  getAdminRequests,
  type AdminRequestListItem,
  type AdminRequestStatus,
  type AdminRequestType,
} from "@/lib/api/admin-requests";

const typeOptions: Array<{ value: AdminRequestType; label: string }> = [
  { value: "BUILDING", label: "Building" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "MESSENGER", label: "Messenger" },
  { value: "DOCUMENT", label: "Document" },
];

const statusOptions: Array<{ value: AdminRequestStatus; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "APPROVED", label: "Approved" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "DONE", label: "Done" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELED", label: "Canceled" },
];

const statusColorClass: Record<AdminRequestStatus, string> = {
  NEW: "bg-sky-100 text-sky-800",
  APPROVED: "bg-indigo-100 text-indigo-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  IN_TRANSIT: "bg-orange-100 text-orange-800",
  DONE: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELED: "bg-slate-200 text-slate-800",
};

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminRequestsPageContent />
    </RouteGuard>
  );
}

function AdminRequestsPageContent() {
  const [items, setItems] = useState<AdminRequestListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [query, setQuery] = useState("");
  const [type, setType] = useState<"" | AdminRequestType>("");
  const [status, setStatus] = useState<"" | AdminRequestStatus>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await getAdminRequests({
          page,
          limit,
          q: query.trim() || undefined,
          type: type || undefined,
          status: status || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });

        if (!active) {
          return;
        }

        setItems(result.items);
        setTotal(result.total);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Failed to load admin requests");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, limit, page, query, status, type]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [limit, total]);

  const handleExportCsv = async () => {
    setExporting(true);
    setErrorMessage(null);

    try {
      const result = await downloadAdminRequestsCsv({
        q: query.trim() || undefined,
        type: type || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 1000,
      });

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to export csv");
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-10 md:px-10">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 5 - Admin Core</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Admin Requests Table</h1>
            <p className="mt-2 text-slate-700">Manage request queue with search, filters, date range, and csv export.</p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100">
              Dashboard
            </Link>
            <Button type="button" onClick={handleExportCsv} disabled={exporting}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-5">
          <TextField
            id="q"
            label="Search"
            value={query}
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="Request no / employee / phone"
          />

          <SelectField
            id="type"
            label="Type"
            value={type}
            onChange={(event) => {
              setPage(1);
              setType(event.target.value as "" | AdminRequestType);
            }}
          >
            <option value="">All</option>
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="status"
            label="Status"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as "" | AdminRequestStatus);
            }}
          >
            <option value="">All</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>

          <TextField
            id="dateFrom"
            label="Date from"
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setPage(1);
              setDateFrom(event.target.value);
            }}
          />

          <TextField
            id="dateTo"
            label="Date to"
            type="date"
            value={dateTo}
            onChange={(event) => {
              setPage(1);
              setDateTo(event.target.value);
            }}
          />
        </div>

        <div className="mt-4">
          <Button
            type="button"
            className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            onClick={() => {
              setQuery("");
              setType("");
              setStatus("");
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
          >
            Reset filters
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-700">Loading requests...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-700">No requests found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Request No</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Urgency</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Latest activity</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3 font-medium text-slate-900">{item.requestNo}</td>
                    <td className="px-3 py-3 text-slate-700">{item.type}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <p>{item.employeeName}</p>
                      <p className="text-xs text-slate-500">{item.phone}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{item.urgency}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColorClass[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{formatDateTime(item.latestActivityAt)}</td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/requests/${item.id}`} className="text-sm font-medium text-slate-900 underline underline-offset-4">
                        View detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            Page {page} / {totalPages} ({total} items)
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              className="bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      {errorMessage ? (
        <section className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {errorMessage}
        </section>
      ) : null}
    </main>
  );
}
