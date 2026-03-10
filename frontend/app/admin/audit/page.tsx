"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RouteGuard } from "@/components/guards/route-guard";
import { Button, SelectField, TextField } from "@/components/ui/form-controls";
import { ApiError } from "@/lib/api/client";
import {
  downloadAdminAuditCsv,
  getAdminAuditLogs,
  type AdminAuditLogItem,
  type AuditAction,
  type AuditActorRole,
} from "@/lib/api/admin-audit";
import { listAdminOperators, type AdminOperator } from "@/lib/api/admin-settings";

const actionOptions: AuditAction[] = [
  "CREATE",
  "APPROVE",
  "REJECT",
  "STATUS_CHANGE",
  "CANCEL",
  "UPLOAD_ATTACHMENT",
  "REPORT_PROBLEM",
  "MESSENGER_PICKUP_EVENT",
];

const actorRoleOptions: AuditActorRole[] = ["EMPLOYEE", "ADMIN", "MESSENGER"];

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function Page() {
  return (
    <RouteGuard tokenType="admin" redirectTo="/admin/login">
      <AdminAuditContent />
    </RouteGuard>
  );
}

function AdminAuditContent() {
  const [items, setItems] = useState<AdminAuditLogItem[]>([]);
  const [operators, setOperators] = useState<AdminOperator[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const [q, setQ] = useState("");
  const [requestNo, setRequestNo] = useState("");
  const [action, setAction] = useState<"" | AuditAction>("");
  const [actorRole, setActorRole] = useState<"" | AuditActorRole>("");
  const [operatorId, setOperatorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOperators() {
      try {
        const result = await listAdminOperators();
        if (active) {
          setOperators(result.items);
        }
      } catch {
        // keep table usable even if operator lookup fails
      }
    }

    void loadOperators();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadLogs() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await getAdminAuditLogs({
          page,
          limit,
          q: q.trim() || undefined,
          requestNo: requestNo.trim() || undefined,
          action: action || undefined,
          actorRole: actorRole || undefined,
          operatorId: operatorId || undefined,
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
          setErrorMessage("Failed to load audit logs");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLogs();

    return () => {
      active = false;
    };
  }, [action, actorRole, dateFrom, dateTo, limit, operatorId, page, q, requestNo]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [limit, total]);

  const handleExportCsv = async () => {
    setExporting(true);
    setErrorMessage(null);

    try {
      const result = await downloadAdminAuditCsv({
        q: q.trim() || undefined,
        requestNo: requestNo.trim() || undefined,
        action: action || undefined,
        actorRole: actorRole || undefined,
        operatorId: operatorId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 5000,
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
        setErrorMessage("Failed to export audit csv");
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
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">Phase 6 - Admin Settings and Audit</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Admin Audit Logs</h1>
            <p className="mt-2 text-slate-700">Review activity timeline and export filtered logs for compliance.</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
            >
              Dashboard
            </Link>
            <Button type="button" onClick={handleExportCsv} disabled={exporting}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <TextField
            id="q"
            label="Quick search"
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
            placeholder="note / requestNo / employee / phone"
          />

          <TextField
            id="requestNo"
            label="Request No"
            value={requestNo}
            onChange={(event) => {
              setPage(1);
              setRequestNo(event.target.value);
            }}
            placeholder="REQ-000001"
          />

          <SelectField
            id="action"
            label="Action"
            value={action}
            onChange={(event) => {
              setPage(1);
              setAction(event.target.value as "" | AuditAction);
            }}
          >
            <option value="">All</option>
            {actionOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="actorRole"
            label="Actor Role"
            value={actorRole}
            onChange={(event) => {
              setPage(1);
              setActorRole(event.target.value as "" | AuditActorRole);
            }}
          >
            <option value="">All</option>
            {actorRoleOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="operatorId"
            label="Operator"
            value={operatorId}
            onChange={(event) => {
              setPage(1);
              setOperatorId(event.target.value);
            }}
          >
            <option value="">All</option>
            {operators.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.displayName}
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

          <div className="flex items-end">
            <Button
              type="button"
              className="w-full bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100"
              onClick={() => {
                setQ("");
                setRequestNo("");
                setAction("");
                setActorRole("");
                setOperatorId("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-700">Loading audit logs...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-700">No audit logs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Created At</th>
                  <th className="px-3 py-2">Request</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Transition</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Operator</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-3 text-slate-700">{formatDateTime(item.createdAt)}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{item.requestNo}</p>
                        <p className="text-xs text-slate-500">{item.requestType} | {item.requestStatus}</p>
                        <Link
                          href={`/admin/requests/${item.requestId}`}
                          className="text-xs font-medium text-slate-900 underline underline-offset-4"
                        >
                          Open request
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{item.action}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {item.fromStatus ?? "-"} to {item.toStatus ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{item.actorRole}</td>
                    <td className="px-3 py-3 text-slate-700">{item.operatorName ?? "-"}</td>
                    <td className="max-w-xs px-3 py-3 text-slate-700">{item.note ?? "-"}</td>
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
