'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Database,
  LogOut,
  TableIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface TableInfo {
  name: string;
  rowEstimate: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

interface TableData {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

export default function DatabasePage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [data, setData] = useState<TableData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [sort, setSort] = useState<string | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetch('/api/admin/tables')
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json() as Promise<{
          tables?: TableInfo[];
          connected?: boolean;
        }>;
      })
      .then((d) => {
        setTables(d.tables ?? []);
        if (d.tables?.length && !selectedTable) {
          setSelectedTable(d.tables[0].name);
        }
      })
      .catch(() => setTables([]))
      .finally(() => setTablesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedTable) return;
    setDataLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (sort) {
        params.set('sort', sort);
        params.set('order', order);
      }
      const res = await fetch(
        `/api/admin/tables/${encodeURIComponent(selectedTable)}?${params}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setDataLoading(false);
    }
  }, [selectedTable, page, pageSize, sort, order]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function selectTable(name: string) {
    setSelectedTable(name);
    setPage(1);
    setSort(null);
    setOrder('asc');
  }

  function toggleSort(col: string) {
    if (sort === col) {
      setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(col);
      setOrder('asc');
    }
    setPage(1);
  }

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/admin/login');
  }

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    if (!data?.columns) return [];
    return data.columns.map((col) => ({
      accessorKey: col.name,
      header: () => (
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => toggleSort(col.name)}
        >
          <span>{col.name}</span>
          <span className="text-[10px] text-muted-foreground">
            {col.type}
          </span>
          {sort === col.name ? (
            order === 'asc' ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )
          ) : (
            <ArrowUpDown className="size-3 opacity-30" />
          )}
        </button>
      ),
      cell: ({ getValue }) => {
        const val = getValue();
        if (val === null) {
          return <span className="text-muted-foreground italic">NULL</span>;
        }
        if (typeof val === 'boolean') {
          return (
            <Badge variant={val ? 'default' : 'secondary'}>
              {String(val)}
            </Badge>
          );
        }
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return (
          <span className="max-w-[300px] truncate block" title={str}>
            {str}
          </span>
        );
      },
    }));
  }, [data?.columns, sort, order]);

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: data ? Math.ceil(data.total / data.pageSize) : 0,
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Database className="size-4" />
          <span className="font-semibold text-sm">Database Admin</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-1.5 size-3.5" />
          退出
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r">
          <div className="p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tables ({tables.length})
          </div>
          <ScrollArea className="h-[calc(100vh-7rem)]">
            <div className="space-y-0.5 px-2 pb-4">
              {tablesLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                  ))
                : tables.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => selectTable(t.name)}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                        selectedTable === t.name
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      }`}
                    >
                      <TableIcon className="size-3.5 shrink-0" />
                      <span className="truncate">{t.name}</span>
                      <span className="ml-auto text-xs opacity-60">
                        ~{t.rowEstimate}
                      </span>
                    </button>
                  ))}
            </div>
          </ScrollArea>
        </aside>

        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {selectedTable ? (
            <>
              {/* Toolbar */}
              <div className="flex h-10 shrink-0 items-center justify-between border-b px-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{selectedTable}</span>
                  {data && (
                    <Badge variant="secondary" className="text-xs">
                      {data.total.toLocaleString()} rows
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    Page {page} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Data table */}
              <div className="flex-1 overflow-auto">
                {dataLoading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              className="whitespace-nowrap text-xs"
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext()
                                  )}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell
                                key={cell.id}
                                className="max-w-[300px] py-1.5 text-xs font-mono"
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length || 1}
                            className="h-24 text-center text-muted-foreground"
                          >
                            No data
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <div className="max-w-md text-center">
                <Database className="mx-auto mb-2 size-8 opacity-40" />
                {tablesLoading ? (
                  <p className="text-sm">加载中…</p>
                ) : tables.length === 0 ? (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      数据库已连接，但未找到任何表
                    </p>
                    <p className="mt-2 text-xs leading-relaxed">
                      生产库可能尚未执行 migration。请在项目根目录运行{' '}
                      <code className="rounded bg-muted px-1 py-0.5">
                        bun run db:migrate
                      </code>{' '}
                      （需配置 DATABASE_URL）。网站 Skills 数据目前来自
                      skills.sh 上游缓存，不依赖本地表。
                    </p>
                  </>
                ) : (
                  <p className="text-sm">选择一个表开始浏览</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
