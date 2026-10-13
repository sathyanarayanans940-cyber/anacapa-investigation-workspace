import { BoardContents } from '@/components/board-contents';
import { useBoardActions } from '@/hooks/use-board-actions';
import { EvidenceSearch } from '@/components/evidence-search';
import { useCaseNavigation } from '@/hooks/use-case-navigation';
import { useBoardGestures, type BoardDrag } from '@/hooks/use-board-gestures';
import { sizeCard, type CardSize } from '@/lib/card-size';
import { visualColor } from '@/components/evidence-card';
import { BoardTool } from '@/components/board-tool';
import { icons } from '@/lib/evidence-display';
import { apiFetch, caseAction, downloadBlob } from '@/lib/api';
import { CaseSetup, FolderPicker } from '@/components/case-setup';
import { CaseRecords } from '@/components/case-records';
import { CaseSharing } from '@/components/case-sharing';
import { UnlockCase, OpenProtectedFile, ChangeReason } from '@/components/case-access';
import { ConnectionEditor } from '@/components/connection-editor';
import { evidenceChanged, compareEvents } from '@/lib/provenance';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Network,
  Clock3,
  Plus,
  ChevronRight,
  Pin,
  SlidersHorizontal,
  Focus,
  Minus,
  Layers,
  FolderOpen,
  CircleHelp,
  Settings2,
  PanelBottom,
  Link2,
  MousePointer2,
  FileText,
  StickyNote,
  Download,
  Upload,
  Undo2,
  Redo2,
  X,
  Check,
  ChevronDown,
  Hand,
  RotateCcw,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  ChartNoAxesGantt,
  List,
  Share2,
  ExternalLink,
  Pencil,
  ShieldCheck,
  LockKeyhole,
  Lock,
} from 'lucide-react';
import { AppearanceSettings } from '@/components/appearance-settings';
import { useAppearance } from '@/components/use-appearance';
import { TimelineRibbon } from '@/components/timeline-ribbon';
import { TimelineStage } from '@/components/timeline-stage';
import { threadLayout } from '@/lib/thread-layout';
import { Relationships } from '@/components/relationships';
import { crossBranchCounts } from '@/lib/relationships';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster, toast } from 'sonner';
import { EvidenceEditor, Picker } from '@/components/evidence-editor';
import {
  sample,
  titleOf,
  Evidence,
  NodeKind,
  Workspace,
  Thread,
  colors,
  descendants,
} from '@/lib/case-data';
import { workspaceSchema } from '@/lib/validation';
import { wallDateLabel, timeLabel } from '@/lib/local-date';
import { useWorkspacePersistence } from '@/hooks/use-workspace-persistence';
import { cardBounds, cardSize, findBoardSpace } from '@/lib/board-placement';
import {
  packInvestigation,
  parseInvestigationPackage,
  packageFileLimit,
  protectedFileLimit,
  type InvestigationPackage,
} from '@/lib/investigation-package';
const kinds = ['Person', 'Event', 'Location', 'Digital', 'Document', 'Note'];
const uid = () => crypto.randomUUID();
const dateLabel = wallDateLabel;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
export default function Page() {
  const [data, setData] = useState<Workspace>(sample);
  const dataRef = useRef(data);
  dataRef.current = data;
  const [editing, setEditing] = useState<Evidence | null>(null);
  const [dialog, setDialog] = useState('');
  const appearance = useAppearance();
  const { theme } = appearance;
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState('All');
  const [onlyPins, setOnlyPins] = useState(false);
  const [showThreads, setShowThreads] = useState(true);
  const [tool, setTool] = useState('select');
  const [tiltId, setTiltId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [deletion, setDeletion] = useState<string | null>(null);
  const [history, setHistory] = useState<Workspace[]>([]);
  const [future, setFuture] = useState<Workspace[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [transfer, setTransfer] = useState('');
  const [caseName, setCaseName] = useState('');
  const [caseDescription, setCaseDescription] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [incoming, setIncoming] = useState<InvestigationPackage | undefined>(),
    [protectedImport, setProtectedImport] = useState<unknown>(null),
    [folderAction, setFolderAction] = useState(''),
    [unlocking, setUnlocking] = useState(false),
    [pendingChange, setPendingChange] = useState<Workspace | null>(null);
  const reasonRef = useRef(''),
    lastActivity = useRef(Date.now()),
    locking = useRef(false),
    pendingAfter = useRef<(() => void) | null>(null),
    pendingHistoryAction = useRef<'edit' | 'undo' | 'redo'>('edit');
  const [relations, setRelations] = useState<{ focus: string | null } | null>(null);
  const {
    mode,
    setMode,
    timelineView,
    setTimelineView,
    scope,
    setScope,
    camera,
    setCamera,
    navigate,
    expandTimeline,
  } = useCaseNavigation(() => {
    setTiltId(null);
    setQuery('');
    setConnectFrom(null);
  });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const boardRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const drag = useRef<BoardDrag | null>(null);
  const c = data.cases.find((c) => c.id === data.activeCase) || data.cases[0];
  const nodeById = useMemo(() => new Map(c.nodes.map((n) => [n.id, n])), [c.nodes]);
  const childCounts = useMemo(() => {
    const counts = new Map<string | null, number>();
    for (const node of c.nodes) counts.set(node.parentId, (counts.get(node.parentId) || 0) + 1);
    return counts;
  }, [c.nodes]);
  const scopeNode = scope ? nodeById.get(scope) : undefined;
  const matches = (n: Evidence) =>
    (filter === 'All' || (n.customKind || n.kind) === filter) &&
    (!onlyPins || n.pinned) &&
    (!query || JSON.stringify(n).toLowerCase().includes(query.toLowerCase()));
  const locked = !!c.security?.locked,
    editable = !locked && c.security?.role !== 'viewer',
    simple = c.controls === 'simple';
  const visible = useMemo(
    () => c.nodes.filter((n) => (query ? true : n.parentId === scope) && matches(n)),
    [c.nodes, query, scope, filter, onlyPins],
  );
  const connections = useMemo(() => {
    const ids = new Set(visible.map((n) => n.id));
    return c.threads.filter((t) => ids.has(t.source) && ids.has(t.target));
  }, [c.threads, visible]);
  const crossCounts = useMemo(() => crossBranchCounts(c.nodes, c.threads), [c.nodes, c.threads]);
  const connectionSource = connectFrom ? nodeById.get(connectFrom) : undefined;
  useEffect(() => {
    if (connectFrom && !connectionSource) setConnectFrom(null);
  }, [connectFrom, connectionSource]);
  const tiltNode = visible.find((n) => n.id === tiltId);
  const tiltAngle = tiltNode ? (tiltNode.rotation ?? (tiltNode.kind === 'Note' ? -2 : 0)) : 0;
  const ancestors: Evidence[] = [];
  let ancestor = scopeNode;
  while (ancestor) {
    ancestors.unshift(ancestor);
    ancestor = ancestor.parentId ? nodeById.get(ancestor.parentId) : undefined;
  }
  const commit = useCallback(
    (fn: (w: Workspace) => Workspace, action: 'edit' | 'undo' | 'redo' = 'edit') => {
      const before = clone(dataRef.current),
        next = fn(clone(before));
      setHistory((h) => (action === 'undo' ? h.slice(0, -1) : [...h.slice(-39), before]));
      setFuture((f) => (action === 'undo' ? [before, ...f] : action === 'redo' ? f.slice(1) : []));
      dataRef.current = next;
      setData(next);
    },
    [],
  );
  const applyChange = (next: Workspace, action: 'edit' | 'undo' | 'redo' = 'edit') => {
    if (!editable) {
      toast.error(locked ? 'Unlock this case first.' : 'This account has view-only access.');
      return false;
    }
    const before = dataRef.current.cases.find((x) => x.id === next.activeCase)!,
      after = next.cases.find((x) => x.id === next.activeCase)!;
    if (before.security?.mode === 'advanced' && evidenceChanged(before, after)) {
      pendingHistoryAction.current = action;
      setPendingChange(next);
      return false;
    }
    commit(() => next, action);
    return true;
  };
  const updateCase = (fn: (v: typeof c) => typeof c) => {
    const w = clone(dataRef.current);
    const next = { ...w, cases: w.cases.map((x) => (x.id === w.activeCase ? fn(x) : x)) };
    const checked = workspaceSchema.safeParse(next);
    if (!checked.success) {
      toast.error(checked.error.issues[0].message);
      return false;
    }
    return applyChange(next);
  };
  const changeTilt = (angle: number) => {
    if (!tiltNode || !loaded) return;
    const rotation = Math.max(-15, Math.min(15, angle));
    if (rotation === tiltAngle) return;
    updateCase((v) => ({
      ...v,
      nodes: v.nodes.map((n) => (n.id === tiltNode.id ? { ...n, rotation } : n)),
    }));
  };
  const undo = () => {
    if (!history.length || !editable) return;
    if (applyChange(history[history.length - 1], 'undo')) setScope(null);
  };
  const redo = () => {
    if (!future.length || !editable) return;
    if (applyChange(future[0], 'redo')) setScope(null);
  };
  function resetAfterLoad(workspace: Workspace) {
    dataRef.current = workspace;
    setData(workspace);
    setHistory([]);
    setFuture([]);
    setPendingChange(null);
    pendingHistoryAction.current = 'edit';
    setIncoming(undefined);
    setProtectedImport(null);
    drag.current = null;
    reasonRef.current = '';
    setScope(null);
    setEditing(null);
    setThread(null);
    setRelations(null);
    setQuery('');
    setFilter('All');
    setOnlyPins(false);
    setExpanded(new Set());
    setTiltId(null);
    setDeletion(null);
    setTool('select');
    setConnectFrom(null);
    pendingAfter.current = null;
    lastActivity.current = Date.now();
  }
  const {
    loaded,
    setLoaded,
    saving,
    setSaving,
    readyRef,
    savingRef,
    conflict,
    recovering,
    setRecovering,
    confirmReload,
    setConfirmReload,
    load,
    persist,
    applyServer,
  } = useWorkspacePersistence(
    data,
    dataRef,
    reasonRef,
    () => !!drag.current,
    resetAfterLoad,
    () => {
      setEditing(null);
      setThread(null);
      setDialog('');
      setHistory([]);
      setFuture([]);
    },
  );
  function forgetProtected() {
    const safe = {
      ...dataRef.current,
      cases: dataRef.current.cases.map((file) =>
        file.security?.mode === 'advanced'
          ? {
              id: file.id,
              title: 'Locked advanced case',
              description: 'Unlock to view this case.',
              nodes: [],
              threads: [],
              security: { ...file.security, locked: true },
            }
          : file,
      ),
    };
    setData(safe);
    dataRef.current = safe;
    setHistory([]);
    setFuture([]);
    setEditing(null);
    setThread(null);
    setRelations(null);
    setDialog('');
    setPendingChange(null);
    pendingHistoryAction.current = 'edit';
    setIncoming(undefined);
    setProtectedImport(null);
    reasonRef.current = '';
    pendingAfter.current = null;
    readyRef.current = false;
    setLoaded(false);
    setSaving('Connection lost · Reconnect');
  }
  async function lockCase(id = c.id, idle = false) {
    if (locking.current) return;
    locking.current = true;
    try {
      if (!idle && !(await persist())) throw Error('Save changes before locking this case.');
      const reply = await caseAction(id, 'lock');
      applyServer(reply);
      setDialog('');
      setUnlocking(false);
      toast(idle ? 'Advanced case locked after inactivity.' : 'Case locked.');
    } catch (e) {
      if (idle) forgetProtected();
      toast.error((e as Error).message);
    } finally {
      locking.current = false;
    }
  }
  useEffect(() => {
    const activity = () => {
      lastActivity.current = Date.now();
    };
    window.addEventListener('pointerdown', activity);
    window.addEventListener('keydown', activity);
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current >= 600000) {
        const open = dataRef.current.cases.filter(
          (v) => v.security?.mode === 'advanced' && !v.security.locked,
        );
        if (open.length)
          void (async () => {
            for (const file of open) await lockCase(file.id, true);
          })();
      }
    }, 5000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('keydown', activity);
    };
  }, []);
  useEffect(() => {
    let checking = false;
    const check = async () => {
      if (checking || locking.current || savingRef.current || !readyRef.current) return;
      const current = dataRef.current.cases.find((v) => v.id === dataRef.current.activeCase);
      if (current?.security?.mode !== 'advanced' || current.security.locked) return;
      checking = true;
      try {
        const r = await apiFetch(`/api/cases/${current.id}/session`);
        if (!r.ok) throw Error();
        const status = await r.json();
        if (status.locked) {
          forgetProtected();
          await load();
          setDialog('');
          toast('Case session locked. Unlock to continue.');
        } else if (Date.now() - lastActivity.current < 30000)
          await caseAction(current.id, 'session');
      } catch {
        forgetProtected();
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void check(), 20000);
    const visible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  async function stageCopy() {
    if (!editable) return;
    try {
      if (!(await persist())) throw Error('Save changes before creating a case-folder copy.');
      const bundle = await packInvestigation(c, async (url) => {
        const r = await apiFetch(url);
        if (!r.ok) throw Error('An attachment could not be read.');
        return new Uint8Array(await r.arrayBuffer());
      });
      setIncoming(bundle);
      setRenaming(false);
      setDialog('newcase');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const moveLabel = (id: string, x: number, y: number) => {
    if (!loaded) return;
    updateCase((v) => ({
      ...v,
      threads: v.threads.map((t) =>
        t.id === id
          ? {
              ...t,
              labelOffset: {
                x: Math.max(-100000, Math.min(100000, x)),
                y: Math.max(-100000, Math.min(100000, y)),
              },
            }
          : t,
      ),
    }));
  };
  const resizeNode = (id: string, requested?: CardSize) => {
    if (!loaded || !editable || tool !== 'select') return;
    const node = dataRef.current.cases
      .find((file) => file.id === dataRef.current.activeCase)
      ?.nodes.find((n) => n.id === id);
    if (!node || (!requested && !node.boardSize)) return;
    const card = Array.from(
      boardRef.current?.querySelectorAll<HTMLElement>('.evidence-card') || [],
    ).find((element) => element.dataset.nodeId === id);
    let resized: Evidence;
    if (requested) {
      const start = {
        ...node,
        width: card?.offsetWidth || cardSize(node).width,
        height: card?.offsetHeight || cardSize(node).height,
        rotation: node.rotation ?? (node.kind === 'Note' ? -2 : 0),
      };
      resized = { ...node, ...sizeCard(start, requested) };
      if (JSON.stringify(resized) === JSON.stringify(node)) return;
    } else {
      const { boardSize, ...automatic } = node;
      resized = automatic;
    }
    updateCase((file) => ({ ...file, nodes: file.nodes.map((n) => (n.id === id ? resized : n)) }));
  };
  const positionNewCard = (node: Evidence) => {
    const el = boardRef.current;
    const measured = new Map(
      Array.from(el?.querySelectorAll<HTMLElement>('.evidence-card') ?? []).map((card) => [
        card.dataset.nodeId,
        { width: card.offsetWidth, height: card.offsetHeight },
      ]),
    );
    const file = dataRef.current.cases.find((v) => v.id === dataRef.current.activeCase)!;
    const occupied = file.nodes
      .filter((n) => n.parentId === node.parentId)
      .map((n) => cardBounds(n, measured.get(n.id)));
    const bounds = cardBounds(node),
      right = el ? (el.clientWidth - camera.x - 30) / camera.z : node.x + 1000;
    const position = findBoardSpace(occupied, bounds, bounds, right);
    return { ...node, x: position.x + node.x - bounds.x, y: position.y + node.y - bounds.y };
  };
  const newNode = (kind: NodeKind = 'Event', parentId: string | null = scope, dated = false) => {
    if (!loaded || !editable) {
      toast.error(
        !editable
          ? 'Unlock the case with edit access first.'
          : 'Load your workspace before adding evidence.',
      );
      return;
    }
    if (c.nodes.length >= 3000) {
      toast.error(
        'This case has reached its 3,000-card limit. Create another case or remove an unused card.',
      );
      return;
    }
    setEditing(
      positionNewCard({
        id: uid(),
        title: '',
        kind,
        summary: '',
        utcOffset: (() => {
          const offset = -new Date().getTimezoneOffset();
          return (
            (offset >= 0 ? '+' : '-') +
            String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0') +
            ':' +
            String(Math.abs(offset) % 60).padStart(2, '0')
          );
        })(),
        timePrecision: 'exact',
        date: dated
          ? dataRef.current.cases
              .find((v) => v.id === dataRef.current.activeCase)
              ?.nodes.find((n) => n.id === parentId)?.date ||
            new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          : '',
        parentId,
        x: Math.max(70, (-camera.x + 160) / camera.z),
        y: Math.max(70, (-camera.y + (scope ? 150 : 100)) / camera.z),
        color: colors[kinds.indexOf(kind) % colors.length],
        pinned: false,
        confidence: 'Unverified',
        fields: [],
        titleField: 'title',
        images: [],
        tags: [],
      }),
    );
  };
  const saveNode = (n: Evidence) => {
    const isNew = !dataRef.current.cases
      .find((v) => v.id === dataRef.current.activeCase)
      ?.nodes.some((x) => x.id === n.id);
    if (isNew) n = positionNewCard(n);
    const next = clone(dataRef.current);
    const file = next.cases.find((v) => v.id === next.activeCase)!;
    file.nodes = file.nodes.some((x) => x.id === n.id)
      ? file.nodes.map((x) => (x.id === n.id ? n : x))
      : [...file.nodes, n];
    const checked = workspaceSchema.safeParse(next);
    if (!checked.success) {
      toast.error(checked.error.issues[0].message);
      return false;
    }
    const applied = updateCase((v) => ({
      ...v,
      nodes: v.nodes.some((x) => x.id === n.id)
        ? v.nodes.map((x) => (x.id === n.id ? n : x))
        : [...v.nodes, n],
    }));
    if (isNew && n.parentId) {
      setExpanded((v) => new Set([...v, n.parentId!]));
      if (mode !== 'timeline') navigate(n.parentId);
    }
    setEditing(null);
    if (isNew && n.parentId === scope && mode !== 'timeline') {
      const el = boardRef.current,
        bounds = cardBounds(n);
      if (el)
        setCamera((v) => ({
          z: v.z,
          x:
            bounds.x * v.z + v.x < 20 || (bounds.x + bounds.width) * v.z + v.x > el.clientWidth - 20
              ? 40 - bounds.x * v.z
              : v.x,
          y:
            bounds.y * v.z + v.y < 20 ||
            (bounds.y + bounds.height) * v.z + v.y > el.clientHeight - 85
              ? 40 - bounds.y * v.z
              : v.y,
        }));
    }
    if (applied) toast.success(isNew && n.parentId ? 'Sub-event added' : 'Evidence saved');
    return true;
  };
  const newRelationship = (source: string, target = '', label = 'connected to') => {
    if (!editable) return;
    setRelations(null);
    setDialog('');
    setThread({ id: uid(), source, target, label, color: colors[0], dashed: true });
    setConnectFrom(null);
  };
  const revealEvidence = (id: string) => {
    const node = nodeById.get(id);
    if (!node) return;
    setRelations(null);
    navigate(node.parentId);
    setMode('split');
    setFilter('All');
    setOnlyPins(false);
    setTool('select');
  };
  const selectNode = (n: Evidence) => {
    if (tool === 'pan') return;
    if (tool === 'tilt') {
      setTiltId(n.id);
      return;
    }
    if (tool === 'connect') {
      if (!editable) return;
      if (!connectFrom) {
        setConnectFrom(n.id);
        toast('Select another item to connect.');
      } else if (connectFrom !== n.id) {
        setThread({
          id: uid(),
          source: connectFrom,
          target: n.id,
          label: 'connected to',
          color: colors[0],
          dashed: false,
        });
        setConnectFrom(null);
      }
    } else navigate(n.id);
  };
  const fit = useCallback(
    (minimum = 0.2) => {
      const el = boardRef.current;
      if (!el) return;
      const file = dataRef.current.cases.find((x) => x.id === dataRef.current.activeCase)!;
      const ns = file.nodes.filter((n) => (query ? true : n.parentId === scope) && matches(n));
      if (!ns.length) {
        setCamera({ x: 0, y: 0, z: 1 });
        return;
      }
      const topSpace = scope ? 140 : 45;
      const ids = new Set(ns.map((n) => n.id));
      const labels = file.threads
        .filter((t) => t.labelOffset && ids.has(t.source) && ids.has(t.target))
        .map((t) => threadLayout(t, file.nodes)!);
      const cards = Array.from(el.querySelectorAll<HTMLElement>('.evidence-card'));
      const bounds = ns.map((n) => {
        const card = cards.find((e) => e.dataset.nodeId === n.id),
          width = card?.offsetWidth || cardSize(n).width,
          height = card?.offsetHeight || cardSize(n).height,
          angle = ((n.rotation ?? (n.kind === 'Note' ? -2 : 0)) * Math.PI) / 180,
          rotatedWidth = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)),
          rotatedHeight = Math.abs(height * Math.cos(angle)) + Math.abs(width * Math.sin(angle));
        return {
          x: n.x + (width - rotatedWidth) / 2,
          y: n.y + (height - rotatedHeight) / 2,
          width: rotatedWidth,
          height: rotatedHeight,
        };
      });
      const minX = Math.min(...bounds.map((n) => n.x), ...labels.map((l) => l.labelX - 110)),
        minY = Math.min(...bounds.map((n) => n.y), ...labels.map((l) => l.labelY - 20));
      const maxX = Math.max(
          ...bounds.map((n) => n.x + n.width),
          ...labels.map((l) => l.labelX + 110),
        ),
        maxY = Math.max(...bounds.map((n) => n.y + n.height), ...labels.map((l) => l.labelY + 20));
      const z = Math.min(
        1.2,
        Math.max(
          minimum,
          Math.min(
            (el.clientWidth - 100) / (maxX - minX),
            (el.clientHeight - topSpace - 85) / (maxY - minY),
          ),
        ),
      );
      setCamera({
        z,
        x: (el.clientWidth - (maxX - minX) * z) / 2 - minX * z,
        y: topSpace - minY * z,
      });
    },
    [scope, query, filter, onlyPins],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!drag.current) fit(0.35);
    }, 100);
    return () => clearTimeout(timer);
  }, [scope, mode, loaded, data.activeCase, fit]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        (e.target as HTMLElement)?.closest('[role=dialog],[role=alertdialog]')
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (window.matchMedia('(max-width: 700px)').matches) setSearchOpen(true);
        else searchRef.current?.focus();
        return;
      }
      if ((e.target as HTMLElement)?.closest('input,textarea,[role=dialog],[contenteditable]'))
        return;
      if (e.key === 'Escape') {
        if (drag.current) pointerCancel();
        setTool('select');
        setConnectFrom(null);
        setQuery('');
      }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        newNode();
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'f') fit();
        if (e.key === 'v') setTool('select');
        if (e.key === 'h') setTool('pan');
        if (e.key === 'c' && editable) setTool('connect');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const { pointerDown, pointerMove, pointerUp, pointerCancel, zoom } = useBoardGestures({
    c,
    tool,
    editable,
    camera,
    cameraRef,
    boardRef,
    drag,
    dataRef,
    setData,
    setCamera,
    setHistory,
    setFuture,
    navigate,
    selectNode,
    setThread,
  });
  const boardActions = useBoardActions({
    onRelationships: (id) => setRelations({ focus: id }),
    onNodeDown: (e, id) => {
      e.stopPropagation();
      pointerDown(e, id);
    },
    onNodeUp: (e, node) => {
      e.stopPropagation();
      if (tool === 'connect' || tool === 'tilt') selectNode(node);
      else pointerUp(e);
    },
    onNodeOpen: selectNode,
    onNodeEdit: (n) => setEditing(clone(n)),
    onNodeExplore: (n) => {
      if (tool === 'select') navigate(n.id);
      else selectNode(n);
    },
    onNodeAddChild: (id) => newNode('Event', id, true),
    onThreadEdit: (t) => setThread(clone(t)),
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    moveLabel,
    resizeNode,
  });
  function exportData() {
    const cases = dataRef.current.cases
      .filter((file) => file.security?.mode !== 'advanced')
      .map((file) => {
        const copy = clone(file);
        delete copy.security;
        return copy;
      });
    if (!cases.length) {
      toast('Use Case records to copy an encrypted case folder.');
      return;
    }
    downloadBlob(
      JSON.stringify({ activeCase: cases[0].id, cases }, null, 2),
      'anacapa-normal-workspace.json',
    );
    toast(
      'Normal cases exported. Use case-folder backups to include originals and history. Advanced cases are excluded.',
    );
  }
  async function importData(file?: File) {
    if (!file || transfer) return;
    setTransfer('Opening investigation…');
    try {
      if (!(await persist())) throw Error('Save pending changes before opening another file.');
      if (file.size > protectedFileLimit)
        throw Error('Choose a protected investigation smaller than 100 MB.');
      const raw = JSON.parse(await file.text());
      if (raw?.format === 'anacapa-encrypted') {
        setProtectedImport(raw);
        setDialog('');
      } else if (raw?.format === 'anacapa-investigation') {
        if (file.size > packageFileLimit)
          throw Error('Plain investigation files must be smaller than 75 MB.');
        setIncoming(parseInvestigationPackage(raw));
        setRenaming(false);
        setDialog('newcase');
      } else {
        throw Error(
          'Choose a .anacapa investigation file. Workspace JSON backups are for manual recovery; open individual case folders to restore originals and history.',
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTransfer('');
      if (importRef.current) importRef.current.value = '';
    }
  }
  const timelineNodes = (parent: string | null, depth = 0): { n: Evidence; depth: number }[] =>
    c.nodes
      .filter((n) => n.parentId === parent && matches(n))
      .sort(compareEvents)
      .flatMap((n) => [
        { n, depth },
        ...(expanded.has(n.id) ? timelineNodes(n.id, depth + 1) : []),
      ]);
  const focusedTimeline = !!query || filter !== 'All' || onlyPins;
  const branchIds = scope ? new Set(descendants(c.nodes, scope)) : null;
  const timelineMatches = c.nodes
    .filter((n) => (query || !branchIds || branchIds.has(n.id)) && matches(n))
    .sort(compareEvents);
  const timelineItems = focusedTimeline
    ? timelineMatches.map((n) => ({ n, depth: 0 }))
    : timelineNodes(scope);
  const toggleExpanded = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  return (
    <div className="app-shell">
      <Toaster
        position="bottom-right"
        theme={theme === 'midnight' || theme === 'blueprint' ? 'dark' : 'light'}
      />
      <div className="workspace">
        <header className="workbar">
          <button
            className="brand-button"
            aria-label="Case files"
            onClick={() => setDialog('cases')}
          >
            <span className="brand-mark">
              <img src={appearance.iconSrc} width="28" height="28" alt="" />
            </span>
            <span>anacapa</span>
          </button>
          <span className="header-divider" />
          <button className="case-switch" onClick={() => setDialog('cases')}>
            {c.title}
            <ChevronDown size={13} />
          </button>
          <div className="header-spacer" />
          <EvidenceSearch
            query={query}
            onChange={setQuery}
            inputRef={searchRef}
            open={searchOpen}
            onOpenChange={setSearchOpen}
            count={visible.length}
          />
          <button
            className="round-button"
            aria-label="Case records"
            title="Case records & security"
            disabled={!loaded || locked}
            onClick={async () => {
              if (await persist()) setDialog('records');
            }}
          >
            <ShieldCheck size={17} />
          </button>
          {c.security?.mode === 'advanced' && !locked && (
            <button
              className="round-button"
              aria-label="Lock case"
              title="Lock case"
              onClick={() => lockCase()}
            >
              <Lock size={15} />
            </button>
          )}
          <button
            className="round-button share-button"
            aria-label="Share investigation"
            title="Share investigation"
            disabled={!loaded || locked || !!transfer}
            onClick={() => setDialog('share')}
          >
            <Share2 size={16} />
          </button>
          <button
            className="round-button settings-button"
            aria-label="Settings"
            title="Settings"
            disabled={!appearance.ready}
            onClick={() => setDialog('themes')}
          >
            <Settings2 size={17} />
          </button>
          <button
            className="primary add-evidence"
            aria-label="Add evidence"
            title="Add evidence (N)"
            onClick={() => newNode()}
            disabled={!loaded || !editable}
          >
            <span className="add-evidence-symbol" aria-hidden="true">
              <Plus size={14} />
            </span>
            <span className="add-evidence-label">Add evidence</span>
          </button>
        </header>
        <main
          className={`case-room mode-${mode} ${simple ? 'simple-case' : ''} ${!editable ? 'read-only-case' : ''}`}
        >
          {c.security?.unavailable ? (
            <div className="locked-case">
              <FolderOpen size={34} />
              <h1>Case folder unavailable</h1>
              <p>
                The folder may have moved, its drive may be disconnected, or its records may be
                damaged. Other cases remain available.
              </p>
              <button className="primary" onClick={() => void load()}>
                Retry folder
              </button>
              <button className="ghost" onClick={() => setFolderAction('open')}>
                Locate moved case folder
              </button>
              <span>{c.security.folder}</span>
            </div>
          ) : locked ? (
            <div className="locked-case">
              <LockKeyhole size={34} />
              <h1>Advanced case locked</h1>
              <p>Unlock with a local account to see the board and its records.</p>
              <button className="primary" onClick={() => setUnlocking(true)}>
                Unlock case
              </button>
              <span>{c.security?.folder}</span>
            </div>
          ) : (
            <>
              {c.security?.mode === 'advanced' && (
                <div className="case-security-strip">
                  <ShieldCheck size={12} />
                  <span>
                    Advanced · {c.security.operator} ·{' '}
                    {c.security.role === 'admin' ? 'Administrator' : c.security.role}
                  </span>
                </div>
              )}
              {mode === 'split' && (
                <div className="timeline-canopy">
                  <TimelineRibbon
                    root
                    nodes={c.nodes}
                    parent={null}
                    selected={ancestors[0]?.id || null}
                    currentScope={scope}
                    onNavigate={navigate}
                    onAdd={() => newNode('Event', null, true)}
                    onExpand={() => expandTimeline(null)}
                  />
                  {ancestors.length > 0 && (
                    <div className="nested-ribbons">
                      {ancestors.map((n, i) => (
                        <TimelineRibbon
                          key={n.id}
                          nodes={c.nodes}
                          parent={n}
                          selected={ancestors[i + 1]?.id || null}
                          currentScope={scope}
                          onNavigate={navigate}
                          onAdd={() => newNode('Event', n.id, true)}
                          onExpand={() => expandTimeline(n.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="board-topline">
                <div className="board-path">
                  <button onClick={() => navigate(null)} className={!scope ? 'path-current' : ''}>
                    All evidence
                  </button>
                  {ancestors.map((n) => (
                    <span key={n.id}>
                      <ChevronRight size={12} />
                      <button
                        className={n.id === scope ? 'path-current' : ''}
                        onClick={() => navigate(n.id)}
                      >
                        {titleOf(n)}
                      </button>
                    </span>
                  ))}
                  <span className="item-count">
                    {mode === 'timeline' && focusedTimeline
                      ? timelineMatches.length
                      : visible.length}{' '}
                    items
                  </span>
                </div>
                <div className="board-options">
                  {mode === 'timeline' && (
                    <button
                      aria-label="Back to board"
                      className="return-board"
                      onClick={() => setMode('split')}
                    >
                      <ArrowLeft size={14} />
                      <span>Back to board</span>
                    </button>
                  )}
                  {!simple && (
                    <>
                      <button
                        className="relationships-launch"
                        aria-label="Relationships"
                        title="Relationships across all timelines"
                        onClick={() => setRelations({ focus: null })}
                      >
                        <Link2 size={14} />
                        <span>Relationships</span>
                      </button>
                      <button
                        className={`icon-button ${onlyPins ? 'selected' : ''}`}
                        aria-label="Pinned evidence"
                        title="Pinned evidence"
                        onClick={() => setOnlyPins((v) => !v)}
                      >
                        <Pin size={15} />
                      </button>
                      <button
                        className={`icon-button ${filter !== 'All' ? 'selected' : ''}`}
                        aria-label="Filters"
                        title="Filters"
                        onClick={() => setDialog('filters')}
                      >
                        <SlidersHorizontal size={15} />
                      </button>
                    </>
                  )}
                  <Tabs value={mode} onValueChange={setMode}>
                    <TabsList>
                      <TabsTrigger
                        value="split"
                        aria-label="Board and timeline"
                        title="Board and timeline"
                      >
                        <PanelBottom size={15} />
                      </TabsTrigger>
                      <TabsTrigger value="board" aria-label="Board only" title="Board only">
                        <Network size={15} />
                      </TabsTrigger>
                      <TabsTrigger
                        value="timeline"
                        aria-label="Timeline only"
                        title="Timeline only"
                      >
                        <Clock3 size={15} />
                        <span className="timeline-tab-label">Timeline</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              {(filter !== 'All' || onlyPins || query) && (
                <div className="filter-strip">
                  {filter !== 'All' && (
                    <button onClick={() => setFilter('All')}>
                      {filter}
                      <X size={12} />
                    </button>
                  )}
                  {onlyPins && (
                    <button onClick={() => setOnlyPins(false)}>
                      Pinned
                      <X size={12} />
                    </button>
                  )}
                  {query && <span>Results from all timelines</span>}
                </div>
              )}
              {mode !== 'timeline' && (
                <div
                  className={`board tool-${tool}`}
                  ref={boardRef}
                  onPointerDown={(e) => pointerDown(e, null)}
                  onPointerMove={pointerMove}
                  onPointerUp={pointerUp}
                  onPointerCancel={pointerCancel}
                  onWheel={(e) => {
                    if (e.ctrlKey || e.metaKey) zoom(e.deltaY > 0 ? 0.93 : 1.07);
                    else setCamera((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
                  }}
                >
                  {scopeNode && (
                    <div className="branch-context">
                      <span className="context-label">Inside this card</span>
                      <div className="branch-heading">
                        <h1>{titleOf(scopeNode)}</h1>
                        <button
                          className="card-edit"
                          aria-label={`Edit ${titleOf(scopeNode)}`}
                          title="Edit details"
                          onClick={() => setEditing(clone(scopeNode))}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="card-edit"
                          aria-label={`Relationships for ${titleOf(scopeNode)}`}
                          title="Relationships for this card"
                          onClick={() => setRelations({ focus: scopeNode.id })}
                        >
                          <Link2 size={13} />
                        </button>
                      </div>
                      <p>{scopeNode.summary}</p>
                    </div>
                  )}
                  <div
                    className="canvas"
                    style={{
                      transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.z})`,
                      left: 0,
                    }}
                  >
                    <BoardContents
                      visible={visible}
                      connections={connections}
                      nodeById={nodeById}
                      crossCounts={crossCounts}
                      childCounts={childCounts}
                      showThreads={showThreads}
                      editable={editable}
                      tool={tool}
                      connectFrom={connectFrom}
                      tiltId={tiltId}
                      actions={boardActions}
                    />
                  </div>
                  {!visible.length && (
                    <div className="empty-board">
                      <Network size={38} />
                      <h2>
                        {query || filter !== 'All' || onlyPins
                          ? 'No matching evidence'
                          : scopeNode
                            ? 'No sub-events yet'
                            : 'No evidence here yet'}
                      </h2>
                      <p>
                        {query
                          ? 'Try another name, date, or detail.'
                          : filter !== 'All' || onlyPins
                            ? 'Adjust the filters to see more evidence.'
                            : scopeNode
                              ? `Add the first event inside ${titleOf(scopeNode)}.`
                              : 'Add a detail to this part of your investigation.'}
                      </p>
                      <button
                        className="primary"
                        onClick={() =>
                          scopeNode ? newNode('Event', scopeNode.id, true) : newNode()
                        }
                      >
                        <Plus size={16} />
                        {scopeNode ? 'Add sub-event' : 'Add evidence'}
                      </button>
                    </div>
                  )}
                  <TooltipProvider delayDuration={250}>
                    <div className="canvas-toolbar" role="toolbar" aria-label="Board tools">
                      {tool === 'connect' && connectFrom && connectionSource && (
                        <div className="connect-anywhere">
                          <span>From {titleOf(connectionSource!)}</span>
                          <button onClick={() => newRelationship(connectFrom)}>
                            Choose from any timeline
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      )}
                      {tool === 'tilt' && (
                        <div
                          className="tilt-panel"
                          onPointerDown={(e) => e.stopPropagation()}
                          role="group"
                          aria-label="Card tilt"
                        >
                          <div className="tilt-heading">
                            <RotateCw size={15} />
                            <span>{tiltNode ? titleOf(tiltNode) : 'Choose a card to tilt'}</span>
                            <button
                              aria-label="Exit tilt mode"
                              title="Done tilting"
                              onClick={() => setTool('select')}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {tiltNode ? (
                            <div className="tilt-controls">
                              <button
                                aria-label="Tilt left by 1 degree"
                                title="Tilt left 1°"
                                disabled={tiltAngle <= -15 || !loaded}
                                onClick={() => changeTilt(tiltAngle - 1)}
                              >
                                <RotateCcw size={16} />
                              </button>
                              <output aria-label="Card angle" aria-live="polite">
                                {tiltAngle > 0 ? '+' : ''}
                                {tiltAngle}°
                              </output>
                              <button
                                aria-label="Tilt right by 1 degree"
                                title="Tilt right 1°"
                                disabled={tiltAngle >= 15 || !loaded}
                                onClick={() => changeTilt(tiltAngle + 1)}
                              >
                                <RotateCw size={16} />
                              </button>
                              <button
                                className="reset-tilt"
                                disabled={tiltAngle === 0 || !loaded}
                                onClick={() => changeTilt(0)}
                              >
                                Reset
                              </button>
                            </div>
                          ) : (
                            <p>Then use the arrows for a gentle tilt.</p>
                          )}
                        </div>
                      )}
                      {[
                        {
                          id: 'select',
                          icon: MousePointer2,
                          label: 'Select (V)',
                          help: 'Select · drag cards to move, drag their lower-right corner to resize. Click to explore; pencil to edit.',
                        },
                        {
                          id: 'pan',
                          icon: Hand,
                          label: 'Pan (H)',
                          help: 'Pan · drag anywhere, including cards, to move the board',
                        },
                        {
                          id: 'connect',
                          icon: Link2,
                          label: 'Connect evidence (C)',
                          help: 'Connect · select two cards to add a thread',
                        },
                        {
                          id: 'tilt',
                          icon: RotateCw,
                          label: 'Tilt cards',
                          help: 'Tilt · choose a card, then adjust its angle',
                        },
                      ]
                        .filter((t) => !simple || t.id !== 'tilt')
                        .map((t) => (
                          <BoardTool
                            className={`tool-button ${tool === t.id ? 'active' : ''}`}
                            key={t.id}
                            label={t.label}
                            help={t.help}
                            aria-pressed={tool === t.id}
                            disabled={!editable && t.id !== 'select' && t.id !== 'pan'}
                            onClick={() => {
                              setTool(t.id);
                              setConnectFrom(null);
                            }}
                          >
                            <t.icon />
                          </BoardTool>
                        ))}
                      <span className="divider" />
                      <BoardTool
                        label="Add evidence (N)"
                        disabled={!editable}
                        onClick={() => newNode()}
                      >
                        <Plus />
                      </BoardTool>
                      {!simple && (
                        <BoardTool
                          label="Add note"
                          disabled={!editable}
                          onClick={() => newNode('Note')}
                        >
                          <StickyNote />
                        </BoardTool>
                      )}
                      <span className="divider" />
                      <BoardTool
                        label="Undo"
                        onClick={undo}
                        disabled={!history.length || !editable}
                      >
                        <Undo2 />
                      </BoardTool>
                      <BoardTool label="Redo" onClick={redo} disabled={!future.length || !editable}>
                        <Redo2 />
                      </BoardTool>
                    </div>
                  </TooltipProvider>
                  <div className="zoom">
                    <button aria-label="Zoom out" onClick={() => zoom(0.85)}>
                      <Minus size={16} />
                    </button>
                    <span>{Math.round(camera.z * 100)}%</span>
                    <button aria-label="Zoom in" onClick={() => zoom(1.15)}>
                      <Plus size={16} />
                    </button>
                    <span className="divider" />
                    <button aria-label="Fit board" title="Fit board (F)" onClick={() => fit()}>
                      <Focus size={17} />
                    </button>
                  </div>
                  <span className="sr-only" aria-live="polite">
                    {tool === 'connect'
                      ? connectFrom
                        ? 'Choose the second item.'
                        : 'Choose two items to connect.'
                      : ''}
                  </span>
                </div>
              )}
              {mode === 'timeline' && (
                <>
                  <div className="timeline-focus-bar">
                    <div>
                      <span className="context-label">
                        {scopeNode ? 'Sub-timeline' : 'Case timeline'}
                      </span>
                      <h1>{scopeNode ? titleOf(scopeNode) : c.title}</h1>
                    </div>
                    <div className="timeline-focus-actions">
                      <div
                        className="timeline-style-switch"
                        role="group"
                        aria-label="Timeline layout"
                      >
                        <button
                          aria-pressed={timelineView === 'chart'}
                          onClick={() => setTimelineView('chart')}
                        >
                          <ChartNoAxesGantt size={14} />
                          <span>Chart</span>
                        </button>
                        <button
                          aria-pressed={timelineView === 'list'}
                          onClick={() => setTimelineView('list')}
                        >
                          <List size={14} />
                          <span>List</span>
                        </button>
                      </div>
                      <button
                        aria-label="Add event"
                        className="ghost"
                        onClick={() => newNode('Event', scope, true)}
                      >
                        <Plus size={14} />
                        <span>Add event</span>
                      </button>
                    </div>
                  </div>
                  {timelineView === 'chart' ? (
                    <TimelineStage
                      flat={focusedTimeline}
                      nodes={focusedTimeline ? timelineMatches : c.nodes}
                      parent={scopeNode ?? null}
                      expanded={expanded}
                      onToggle={toggleExpanded}
                      onEdit={(n) => setEditing(clone(n))}
                      onBoard={(id) => {
                        navigate(id);
                        setMode('split');
                      }}
                      onAdd={(id) => newNode('Event', id, true)}
                      onArrange={(id, patch) =>
                        updateCase((v) => ({
                          ...v,
                          nodes: v.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
                        }))
                      }
                    />
                  ) : (
                    <div className="chronology">
                      <div className="timeline-list">
                        {timelineItems.map(({ n, depth }) => {
                          const children = childCounts.get(n.id) || 0;
                          const Icon = icons[n.kind];
                          return (
                            <div
                              className="timeline-row"
                              key={n.id}
                              style={
                                {
                                  marginLeft: depth * 28,
                                  '--node-color': visualColor(n.color),
                                } as React.CSSProperties
                              }
                            >
                              <div className="row-date">
                                <strong>{dateLabel(n.date)}</strong>
                                <span>{timeLabel(n) || 'No time set'}</span>
                              </div>
                              <div className="row-marker">
                                <Icon size={17} />
                              </div>
                              <div className="row-main">
                                <button
                                  className="row-open"
                                  aria-label={`Open ${titleOf(n)}`}
                                  onClick={() => {
                                    if (children) setExpanded((v) => new Set([...v, n.id]));
                                    else {
                                      navigate(n.id);
                                      setMode('split');
                                    }
                                  }}
                                >
                                  <span className="subtle">
                                    {n.customKind || n.kind} · {n.confidence}
                                  </span>
                                  <strong>{titleOf(n)}</strong>
                                  <p>{n.summary}</p>
                                </button>
                                <button
                                  className="card-edit row-edit"
                                  aria-label={`Edit ${titleOf(n)}`}
                                  title="Edit details"
                                  onClick={() => setEditing(clone(n))}
                                >
                                  <Pencil size={13} />
                                </button>
                                <div className="row-actions">
                                  {children > 0 && (
                                    <button className="ghost" onClick={() => toggleExpanded(n.id)}>
                                      {expanded.has(n.id) ? (
                                        <ChevronDown size={14} />
                                      ) : (
                                        <ChevronRight size={14} />
                                      )}{' '}
                                      {children} sub-events
                                    </button>
                                  )}
                                  <button
                                    className="ghost"
                                    onClick={() => {
                                      navigate(n.id);
                                      setMode('split');
                                    }}
                                  >
                                    <Layers size={14} />
                                    Open branch
                                  </button>
                                  <button
                                    className="ghost"
                                    aria-label={`Add sub-event inside ${titleOf(n)}`}
                                    onClick={() => newNode('Event', n.id, true)}
                                  >
                                    <Plus size={14} />
                                    Sub-event
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {!timelineItems.length && (
                        <div className="empty-timeline">No events in this branch yet.</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <footer className="statusbar">
            <button
              onClick={() =>
                conflict.current ? setRecovering(true) : loaded ? void persist() : void load()
              }
            >
              <span className={`saved-dot ${saving.includes('saved') ? '' : 'pending'}`} />
              {saving}
            </button>
            <div>
              <span>
                {c.id === 'case-harbor' ? 'Sample case · ' : ''}
                {c.threads.length} {c.threads.length === 1 ? 'connection' : 'connections'}
              </span>
              <button aria-label="Help" onClick={() => setDialog('help')}>
                <CircleHelp size={14} />
              </button>
            </div>
          </footer>
        </main>
      </div>
      {editing && (
        <EvidenceEditor
          simple={simple}
          caseId={c.security?.managed ? c.id : undefined}
          readOnly={!editable}
          key={editing.id}
          initial={editing}
          nodes={c.nodes}
          onClose={() => setEditing(null)}
          onSave={saveNode}
          onDelete={() => {
            if (c.nodes.some((n) => n.id === editing.id)) setDeletion(editing.id);
            else setEditing(null);
          }}
          onExplore={() => {
            navigate(editing.id);
            setMode('split');
          }}
          onAddSubEvent={(parent) => {
            const prior = c.nodes.find((n) => n.id === parent.id);
            if (
              c.security?.mode === 'advanced' &&
              (!prior || evidenceChanged({ ...c, nodes: [prior] }, { ...c, nodes: [parent] }))
            ) {
              pendingAfter.current = () => newNode('Event', parent.id, true);
              if (!saveNode(parent)) pendingAfter.current = null;
            } else {
              if (saveNode(parent)) newNode('Event', parent.id, true);
            }
          }}
        />
      )}
      {thread && (
        <ConnectionEditor
          thread={thread}
          nodes={c.nodes}
          editable={editable}
          existing={c.threads.some((t) => t.id === thread.id)}
          onChange={setThread}
          onClose={() => setThread(null)}
          onSave={(value) => {
            const applied = updateCase((file) => ({
              ...file,
              threads: file.threads.some((t) => t.id === value.id)
                ? file.threads.map((t) => (t.id === value.id ? value : t))
                : [...file.threads, value],
            }));
            setThread(null);
            setTool('select');
            if (applied) toast.success('Connection saved');
          }}
          onRemove={(id) => {
            updateCase((file) => ({ ...file, threads: file.threads.filter((t) => t.id !== id) }));
            setThread(null);
          }}
        />
      )}
      {relations && (
        <Relationships
          file={c}
          focus={relations.focus}
          onClose={() => setRelations(null)}
          onNew={newRelationship}
          onEdit={(t) => {
            setRelations(null);
            setThread(clone(t));
          }}
          onReveal={revealEvidence}
        />
      )}
      <AlertDialog open={!!deletion} onOpenChange={(v) => !v && setDeletion(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this evidence?</AlertDialogTitle>
          <AlertDialogDescription>
            Its nested timeline and connected threads will also be removed. You can undo this from
            the board.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep evidence</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const ids = new Set([deletion!, ...descendants(c.nodes, deletion!)]);
                updateCase((c) => ({
                  ...c,
                  nodes: c.nodes.filter((n) => !ids.has(n.id)),
                  threads: c.threads.filter((t) => !ids.has(t.source) && !ids.has(t.target)),
                }));
                setEditing(null);
                if (scope && ids.has(scope)) navigate(null);
                setDeletion(null);
              }}
            >
              Delete evidence
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {dialog === 'newcase' && !renaming && (
        <CaseSetup
          incoming={incoming}
          onClose={() => {
            setIncoming(undefined);
            setDialog('');
          }}
          onCreated={(reply) => {
            applyServer(reply);
            setIncoming(undefined);
            setDialog('');
            setMode('split');
            toast.success('Case folder created.');
          }}
        />
      )}
      {dialog === 'records' && (
        <CaseRecords
          file={c}
          onClose={() => setDialog('')}
          onRefresh={applyServer}
          onLock={() => lockCase()}
          onMove={stageCopy}
        />
      )}
      <Dialog open={recovering} onOpenChange={setRecovering}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Keep your unsaved work</DialogTitle>
            <DialogDescription>
              Another window saved a newer version. This window still holds your changes. Download a
              recovery copy of each case you changed before loading the latest workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-form">
            <p>
              Current case: <strong>{c.title}</strong>
            </p>
            <div className="dialog-footer">
              <button
                className="ghost"
                onClick={() => {
                  setRecovering(false);
                  setConfirmReload(true);
                }}
              >
                Load latest…
              </button>
              <button
                className="primary"
                disabled={locked}
                onClick={() => {
                  setRecovering(false);
                  setDialog('share');
                }}
              >
                Download recovery copy
              </button>
            </div>
            <p className="field-hint">
              The recovery copy keeps your current cards and attachments. Use Case files to download
              copies of other changed cases.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmReload} onOpenChange={setConfirmReload}>
        <AlertDialogContent>
          <AlertDialogTitle>Load the latest workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            Unsaved changes in this window will be discarded. Download your recovery copies first.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my changes</AlertDialogCancel>
            <AlertDialogAction onClick={() => void load()}>Discard & load latest</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {dialog === 'share' && (
        <CaseSharing
          file={c}
          onClose={() => setDialog('')}
          localCopy={conflict.current}
          beforeExport={() => (conflict.current ? Promise.resolve(true) : persist())}
        />
      )}
      {unlocking && (
        <UnlockCase
          id={c.id}
          onClose={() => setUnlocking(false)}
          onUnlocked={(reply) => {
            applyServer(reply);
            setUnlocking(false);
          }}
        />
      )}
      {!!protectedImport && (
        <OpenProtectedFile
          envelope={protectedImport}
          onClose={() => setProtectedImport(null)}
          onOpened={(bundle) => {
            setProtectedImport(null);
            setIncoming(bundle);
            setRenaming(false);
            setDialog('newcase');
          }}
        />
      )}
      {pendingChange && (
        <ChangeReason
          onClose={() => {
            setPendingChange(null);
            pendingAfter.current = null;
            pendingHistoryAction.current = 'edit';
          }}
          onConfirm={(reason) => {
            reasonRef.current = [reasonRef.current, reason].filter(Boolean).join('; ');
            const action = pendingHistoryAction.current;
            commit(() => pendingChange, action);
            pendingHistoryAction.current = 'edit';
            if (action !== 'edit') setScope(null);
            setPendingChange(null);
            const after = pendingAfter.current;
            pendingAfter.current = null;
            after?.();
            toast.success('Change recorded.');
          }}
        />
      )}
      {folderAction && (
        <FolderPicker
          title="Open a case folder"
          onClose={() => setFolderAction('')}
          onSelect={async (folder) => {
            try {
              if (!(await persist())) return;
              const r = await apiFetch('/api/cases/open-folder', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ folder }),
                }),
                reply = await r.json();
              if (!r.ok) throw Error(reply.error);
              applyServer(reply);
              setFolderAction('');
              setDialog('');
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
      <Dialog
        open={
          !!dialog &&
          dialog !== 'share' &&
          dialog !== 'records' &&
          (dialog !== 'newcase' || renaming)
        }
        onOpenChange={(v) => !v && setDialog('')}
      >
        <DialogContent className={dialog === 'themes' ? 'appearance-dialog' : ''}>
          <DialogHeader>
            <DialogTitle>
              {
                {
                  themes: 'Settings',
                  cases: 'Your case files',
                  newcase: renaming ? 'Edit case' : 'Start a new investigation',
                  filters: 'Focus your investigation',
                  share: 'Save & share',
                  help: 'Using Anacapa',
                }[dialog]
              }
            </DialogTitle>
            <DialogDescription>
              {
                {
                  themes: 'A workspace that feels like yours.',
                  cases: 'Open a case or start another investigation.',
                  newcase: 'Give this investigation a name and a little context.',
                  filters: 'Choose which details appear on your board and timeline.',
                  share: 'Save an editable case or a view-only copy.',
                  help: 'Evidence and time, connected in one workspace.',
                }[dialog]
              }
            </DialogDescription>
          </DialogHeader>
          {dialog === 'themes' && (
            <>
              <div className="controls-choice">
                <div>
                  <strong>Case controls</strong>
                  <small>
                    {simple
                      ? 'Start with the essentials. More fields remain available.'
                      : 'All board tools and evidence fields.'}
                  </small>
                </div>
                <div role="group" aria-label="Case controls">
                  <button
                    aria-pressed={simple}
                    disabled={!editable}
                    onClick={() => {
                      updateCase((v) => ({ ...v, controls: 'simple' }));
                      setTool('select');
                      setFilter('All');
                      setOnlyPins(false);
                    }}
                  >
                    Simple
                  </button>
                  <button
                    aria-pressed={!simple}
                    disabled={!editable}
                    onClick={() => updateCase((v) => ({ ...v, controls: 'full' }))}
                  >
                    Full
                  </button>
                </div>
                <p>
                  Controls can change at any time.{' '}
                  {c.security?.mode === 'advanced'
                    ? 'Advanced protection remains enabled.'
                    : 'This case uses Normal protection.'}
                </p>
              </div>
              <AppearanceSettings
                value={appearance.preferences}
                onChange={appearance.setPreferences}
                dark={appearance.dark}
                stored={appearance.stored}
              />
            </>
          )}
          {dialog === 'filters' && (
            <div className="dialog-form">
              <label>
                Evidence type
                <Picker
                  label="Filter evidence type"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    'All',
                    ...new Set([
                      ...kinds,
                      ...c.nodes.map((n) => n.customKind).filter((v): v is string => !!v),
                    ]),
                  ].map((x) => ({ value: x, label: x === 'All' ? 'All evidence' : x }))}
                />
              </label>
              <label className="switch-row">
                Pinned evidence only
                <Switch checked={onlyPins} onCheckedChange={setOnlyPins} />
              </label>
              <label className="switch-row">
                Show connecting threads
                <Switch checked={showThreads} onCheckedChange={setShowThreads} />
              </label>
              <button className="primary" onClick={() => setDialog('')}>
                Apply filters
              </button>
            </div>
          )}
          {dialog === 'cases' && (
            <div className="case-list">
              {data.cases.map((file) => (
                <button
                  className={file.id === c.id ? 'current' : ''}
                  key={file.id}
                  onClick={() => {
                    commit((w) => ({ ...w, activeCase: file.id }));
                    setHistory([]);
                    setFuture([]);
                    navigate(null);
                    setExpanded(new Set());
                    setTool('select');
                    setFilter('All');
                    setOnlyPins(false);
                    setDialog('');
                  }}
                >
                  <FolderOpen size={21} />
                  <span>
                    <strong>{file.title}</strong>
                    <small>
                      {file.security?.unavailable
                        ? 'Folder unavailable'
                        : file.security?.locked
                          ? 'Locked · Advanced'
                          : `${file.nodes.length} items · ${file.security?.mode === 'advanced' ? 'Advanced' : file.controls === 'simple' ? 'Simple' : 'Normal'}`}
                    </small>
                  </span>
                  {file.id === c.id && <Check size={16} />}
                </button>
              ))}
              <button
                className="primary"
                disabled={!loaded}
                onClick={async () => {
                  if (!(await persist())) return;
                  setIncoming(undefined);
                  setCaseName('');
                  setCaseDescription('');
                  setRenaming(false);
                  setDialog('newcase');
                }}
              >
                <Plus size={16} />
                New case
              </button>
              <button
                className="ghost"
                disabled={!editable}
                onClick={() => {
                  setCaseName(c.title);
                  setCaseDescription(c.description);
                  setRenaming(true);
                  setDialog('newcase');
                }}
              >
                Edit current case
              </button>
              <button
                className="ghost"
                disabled={!loaded}
                onClick={() => {
                  setDialog('');
                  setFolderAction('open');
                }}
              >
                <FolderOpen size={16} />
                Open case folder
              </button>
              <div className="case-transfer">
                <button className="ghost" onClick={exportData}>
                  <Download size={16} />
                  Workspace backup
                </button>
                <button
                  className="ghost"
                  disabled={!loaded || !!transfer}
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={16} />
                  Open .anacapa file
                </button>
              </div>
              {transfer && (
                <p role="status" className="transfer-status">
                  {transfer}
                </p>
              )}
              <input
                hidden
                ref={importRef}
                type="file"
                accept=".anacapa,.json,application/json"
                onChange={(e) => importData(e.target.files?.[0])}
              />
            </div>
          )}
          {dialog === 'newcase' && (
            <form
              className="dialog-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (renaming)
                  updateCase((c) => ({
                    ...c,
                    title: caseName.trim(),
                    description: caseDescription,
                  }));
                else {
                  const id = uid();
                  commit((w) => ({
                    ...w,
                    activeCase: id,
                    cases: [
                      ...w.cases,
                      {
                        id,
                        title: caseName.trim(),
                        description: caseDescription,
                        nodes: [],
                        threads: [],
                      },
                    ],
                  }));
                  navigate(null);
                }
                setDialog('');
              }}
            >
              <label>
                Case name
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  placeholder="The bigger picture…"
                />
              </label>
              <label>
                Description
                <textarea
                  maxLength={20000}
                  rows={3}
                  value={caseDescription}
                  onChange={(e) => setCaseDescription(e.target.value)}
                  placeholder="What are you trying to piece together?"
                />
              </label>
              <button className="primary" disabled={!caseName.trim()}>
                {renaming ? 'Save case' : 'Create case'}
              </button>
            </form>
          )}
          {dialog === 'help' && (
            <div className="help-content">
              <div className="help-downloads">
                <a href="/guide/Case-security.html" target="_blank" rel="noreferrer">
                  <ShieldCheck size={17} />
                  <span>
                    <strong>Case folders & security guide</strong>
                    <small>Simple, Normal, Advanced, checkpoints</small>
                  </span>
                  <ExternalLink size={14} />
                </a>
                <a href="/guide/Anacapa-Guide.pdf" download>
                  <FileText size={17} />
                  <span>
                    <strong>Illustrated user guide</strong>
                    <small>28 pages · Complete guide · PDF</small>
                  </span>
                  <Download size={14} />
                </a>
                <a href="/examples/Harbor-Tutorial.anacapa" download>
                  <FolderOpen size={17} />
                  <span>
                    <strong>Harbor Tutorial</strong>
                    <small>Practice case · open through the case menu</small>
                  </span>
                  <Download size={14} />
                </a>
              </div>
              <p>
                <strong>1. Add a card.</strong> Use Add evidence. Start with a name and type; notes,
                dates, and other details are optional. Choose Custom type to use your own label.
              </p>
              <p>
                <strong>2. Connect the pieces.</strong> Choose the link tool, click two cards, and
                name the relationship. Select moves cards and thread labels. Pan moves the whole
                board. Relationships lets you choose cards across any timelines, and Shared details
                suggests matches to review. Hover the toolbar icons to see their names.
              </p>
              <p>
                <strong>Resize a card.</strong> In Select, drag its lower-right corner. Smaller
                cards show the title; larger ones show more of the preview. Evidence stays intact.
                Double-click the grip to return to automatic size. You can also focus the grip and
                use arrow keys, Shift for ten pixels, or Home to reset. Sizes save per card and are
                included in editable files and new HTML snapshots.
              </p>
              <p>
                <strong>3. Follow the timeline.</strong> Click a card to open its sub-events and
                evidence. Use the pencil beside its date to edit details. The small plus in a card’s
                footer adds a sub-event inside it. Click an event on the top line to open its
                evidence and sub-timeline. Click an ancestor to go back. The expand arrow opens a
                large timeline chart. Each chart card’s sliders menu lets you move it above or below
                the line and choose Card, Compact, or Note.
              </p>
              <p>
                <strong>Save and share.</strong> Changes save on this computer. Share → Download to
                edit creates a .anacapa file; open it through the case menu. Download to view
                creates an HTML snapshot anyone can open in a browser.
              </p>
              <details>
                <summary>More tools & shortcuts</summary>
                <p>
                  Add phone numbers, links, addresses, IPs, files, or any custom fields under
                  Details & attachments. Use the pencil to edit a card. Card appearance lets you
                  choose a field as the title, pin the card, or add tags. Tilt rotates a card
                  deliberately. Undo/redo restores recent changes.
                </p>
                <div className="shortcuts">
                  {[
                    ['N', 'New evidence'],
                    ['C', 'Connect cards'],
                    ['F', 'Fit board'],
                    ['V / H', 'Select / Pan'],
                    ['⌘ / Ctrl K', 'Search'],
                    ['⌘ / Ctrl Z', 'Undo'],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <span>{label}</span>
                      <kbd>{key}</kbd>
                    </div>
                  ))}
                </div>
              </details>
              <p className="subtle">
                No external account or internet is needed. New cases use a folder you choose. Simple
                mode has fewer controls; switch to Full in Settings without changing protection.
                Signed checkpoints are stored outside new case folders. Advanced mode adds
                encryption, local roles, reasons for evidence changes, and a 10-minute lock. Case
                records holds permanent history, integrity checks, custody, and backup copies. A UTC
                offset makes timeline ordering consistent across time zones; blank offsets use the
                computer’s local zone.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
