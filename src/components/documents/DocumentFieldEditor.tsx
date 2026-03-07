import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Pen, Type, Calendar, CheckSquare, Hash, Image, Stamp, AtSign,
  Trash2, GripVertical, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  MousePointer, Maximize2, Minimize2, Copy,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type FieldType = 'signature' | 'initials' | 'date' | 'text' | 'checkbox' | 'dropdown' | 'image' | 'stamp' | 'email' | 'number';

export interface PlacedField {
  id: string;
  type: FieldType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  signerId: string;
  required: boolean;
}

interface Signer {
  id: string;
  name: string;
  color: string;
}

interface DocumentFieldEditorProps {
  signers: Signer[];
  fields: PlacedField[];
  onFieldsChange: (fields: PlacedField[]) => void;
  totalPages?: number;
  documentUrl?: string;
}

const fieldTypes: { type: FieldType; label: string; icon: React.ElementType; defaultW: number; defaultH: number }[] = [
  { type: 'signature', label: 'Assinatura', icon: Pen, defaultW: 200, defaultH: 60 },
  { type: 'initials', label: 'Iniciais', icon: AtSign, defaultW: 80, defaultH: 40 },
  { type: 'date', label: 'Data', icon: Calendar, defaultW: 140, defaultH: 32 },
  { type: 'text', label: 'Texto', icon: Type, defaultW: 180, defaultH: 32 },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, defaultW: 24, defaultH: 24 },
  { type: 'number', label: 'Número', icon: Hash, defaultW: 120, defaultH: 32 },
  { type: 'email', label: 'Email', icon: AtSign, defaultW: 180, defaultH: 32 },
  { type: 'image', label: 'Imagem', icon: Image, defaultW: 120, defaultH: 80 },
  { type: 'stamp', label: 'Carimbo', icon: Stamp, defaultW: 100, defaultH: 100 },
];

const signerColors = [
  'hsl(152, 62%, 42%)',  // green
  'hsl(210, 92%, 45%)',  // blue
  'hsl(38, 92%, 50%)',   // amber
  'hsl(280, 65%, 55%)',  // purple
  'hsl(0, 84%, 60%)',    // red
  'hsl(180, 60%, 40%)',  // teal
];

export function getSignerColor(index: number) {
  return signerColors[index % signerColors.length];
}

export default function DocumentFieldEditor({
  signers,
  fields,
  onFieldsChange,
  totalPages = 3,
}: DocumentFieldEditorProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeSigner, setActiveSigner] = useState(signers[0]?.id || '');
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingFieldId, setResizingFieldId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const pageFields = fields.filter((f) => f.page === currentPage);

  const generateId = () => `field_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const addField = (type: FieldType) => {
    const fieldConfig = fieldTypes.find((f) => f.type === type)!;
    const newField: PlacedField = {
      id: generateId(),
      type,
      label: fieldConfig.label,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 300,
      width: fieldConfig.defaultW,
      height: fieldConfig.defaultH,
      page: currentPage,
      signerId: activeSigner,
      required: true,
    };
    onFieldsChange([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<PlacedField>) => {
    onFieldsChange(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const deleteField = (id: string) => {
    onFieldsChange(fields.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const duplicateField = (id: string) => {
    const field = fields.find((f) => f.id === id);
    if (!field) return;
    const newField = { ...field, id: generateId(), x: field.x + 20, y: field.y + 20 };
    onFieldsChange([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  // Mouse drag for moving fields
  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const scale = zoom / 100;

    setDraggingFieldId(fieldId);
    setSelectedFieldId(fieldId);
    setDragOffset({
      x: (e.clientX - rect.left) / scale - field.x,
      y: (e.clientY - rect.top) / scale - field.y,
    });
  };

  const handleResizeStart = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    setResizingFieldId(fieldId);
    setResizeStart({ x: e.clientX, y: e.clientY, w: field.width, h: field.height });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingFieldId) {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const scale = zoom / 100;
        const x = Math.max(0, Math.min((e.clientX - rect.left) / scale - dragOffset.x, 595 - 50));
        const y = Math.max(0, Math.min((e.clientY - rect.top) / scale - dragOffset.y, 842 - 30));
        updateField(draggingFieldId, { x, y });
      }
      if (resizingFieldId) {
        const dx = e.clientX - resizeStart.x;
        const dy = e.clientY - resizeStart.y;
        const scale = zoom / 100;
        updateField(resizingFieldId, {
          width: Math.max(24, resizeStart.w + dx / scale),
          height: Math.max(20, resizeStart.h + dy / scale),
        });
      }
    };

    const handleMouseUp = () => {
      setDraggingFieldId(null);
      setResizingFieldId(null);
    };

    if (draggingFieldId || resizingFieldId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingFieldId, resizingFieldId, dragOffset, resizeStart, zoom]);

  const getSignerInfo = (signerId: string) => {
    const idx = signers.findIndex((s) => s.id === signerId);
    return { signer: signers[idx], color: getSignerColor(idx) };
  };

  const getFieldIcon = (type: FieldType) => {
    const config = fieldTypes.find((f) => f.type === type);
    return config ? config.icon : Type;
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  return (
    <div className="flex h-full gap-0 bg-secondary/30 rounded-xl overflow-hidden border border-border">
      {/* Left toolbar - Field types */}
      <div className="w-56 bg-card border-r border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campos</p>
        </div>

        {/* Active signer selector */}
        <div className="p-3 border-b border-border">
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Atribuir campos para:</p>
          <Select value={activeSigner} onValueChange={setActiveSigner}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {signers.map((s, i) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getSignerColor(i) }} />
                    <span>{s.name || `Signatário ${i + 1}`}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Field type buttons */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 scrollbar-thin">
          {fieldTypes.map((ft) => (
            <Tooltip key={ft.type}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => addField(ft.type)}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-foreground hover:bg-secondary transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <ft.icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{ft.label}</p>
                    <p className="text-[10px] text-muted-foreground">{ft.defaultW}×{ft.defaultH}</p>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Clique para adicionar campo de {ft.label.toLowerCase()}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Field count per signer */}
        <div className="p-3 border-t border-border space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Campos por signatário</p>
          {signers.map((s, i) => {
            const count = fields.filter((f) => f.signerId === s.id).length;
            return (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getSignerColor(i) }} />
                  <span className="text-muted-foreground truncate max-w-[120px]">{s.name || `Signatário ${i + 1}`}</span>
                </div>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{count}</Badge>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center - Document canvas */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <span className="text-xs text-muted-foreground font-medium min-w-[80px] text-center">
              Página {currentPage} de {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(Math.max(50, zoom - 10))}>
              <ZoomOut className="w-3 h-3" />
            </Button>
            <span className="text-xs text-muted-foreground font-medium w-10 text-center">{zoom}%</span>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(Math.min(150, zoom + 10))}>
              <ZoomIn className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {selectedField && (
              <>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => duplicateField(selectedFieldId!)}>
                  <Copy className="w-3 h-3 mr-1" />Duplicar
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteField(selectedFieldId!)}>
                  <Trash2 className="w-3 h-3 mr-1" />Remover
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto p-6 flex justify-center" onClick={() => setSelectedFieldId(null)}>
          <div
            ref={containerRef}
            className="relative bg-white shadow-xl rounded-sm"
            style={{
              width: 595 * (zoom / 100),
              height: 842 * (zoom / 100),
              transform: `scale(1)`,
              transformOrigin: 'top center',
            }}
          >
            {/* Simulated document content */}
            <div className="absolute inset-0 p-12" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left', width: 595, height: 842 }}>
              {/* Simulated page header lines */}
              <div className="space-y-6">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-5/6" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-4/5" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
                {currentPage === 1 && (
                  <>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mt-8" />
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                    </div>
                  </>
                )}
                {currentPage === 2 && (
                  <>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-5/6" />
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-2/5 mt-4" />
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-4/5" />
                    </div>
                  </>
                )}
                {currentPage === totalPages && (
                  <div className="mt-8 space-y-8">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="flex justify-between">
                      <div className="space-y-1 w-40">
                        <div className="h-px bg-gray-300" />
                        <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                      </div>
                      <div className="space-y-1 w-40">
                        <div className="h-px bg-gray-300" />
                        <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Placed fields */}
            {pageFields.map((field) => {
              const { signer, color } = getSignerInfo(field.signerId);
              const FieldIcon = getFieldIcon(field.type);
              const isSelected = selectedFieldId === field.id;
              const scale = zoom / 100;

              return (
                <div
                  key={field.id}
                  className={cn(
                    'absolute cursor-move group transition-shadow',
                    isSelected ? 'z-20' : 'z-10',
                    draggingFieldId === field.id && 'opacity-80'
                  )}
                  style={{
                    left: field.x * scale,
                    top: field.y * scale,
                    width: field.width * scale,
                    height: field.height * scale,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, field.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFieldId(field.id);
                  }}
                >
                  {/* Field visual */}
                  <div
                    className={cn(
                      'w-full h-full rounded border-2 flex items-center justify-center gap-1 transition-all',
                      isSelected
                        ? 'shadow-lg ring-2 ring-offset-1'
                        : 'shadow-sm hover:shadow-md',
                    )}
                    style={{
                      borderColor: color,
                      backgroundColor: `${color}15`,
                      ...(isSelected ? { ringColor: color } : {}),
                    }}
                  >
                    <FieldIcon className="shrink-0" style={{ color, width: Math.min(14 * scale, 16), height: Math.min(14 * scale, 16) }} />
                    {field.width * scale > 60 && (
                      <span className="text-[10px] font-medium truncate" style={{ color, fontSize: Math.min(10 * scale, 11) }}>
                        {field.label}
                      </span>
                    )}
                  </div>

                  {/* Signer badge */}
                  {isSelected && signer && (
                    <div
                      className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-medium text-white whitespace-nowrap"
                      style={{ backgroundColor: color }}
                    >
                      {signer.name || 'Signatário'}
                    </div>
                  )}

                  {/* Resize handle */}
                  {isSelected && (
                    <div
                      className="absolute -bottom-1 -right-1 w-3 h-3 rounded-sm cursor-se-resize z-30"
                      style={{ backgroundColor: color }}
                      onMouseDown={(e) => handleResizeStart(e, field.id)}
                    />
                  )}

                  {/* Required indicator */}
                  {field.required && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive" />
                  )}
                </div>
              );
            })}

            {/* Page number */}
            <div className="absolute bottom-3 left-0 right-0 text-center" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'bottom center' }}>
              <span className="text-[10px] text-gray-400">{currentPage} / {totalPages}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel - Field properties */}
      <div className="w-56 bg-card border-l border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Propriedades</p>
        </div>
        {selectedField ? (
          <div className="p-3 space-y-3 flex-1 overflow-y-auto scrollbar-thin">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Tipo</label>
              <div className="flex items-center gap-2 p-2 bg-secondary rounded-lg">
                {(() => { const Icon = getFieldIcon(selectedField.type); return <Icon className="w-4 h-4 text-muted-foreground" />; })()}
                <span className="text-xs font-medium">{selectedField.label}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Rótulo</label>
              <input
                className="w-full h-7 px-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={selectedField.label}
                onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Signatário</label>
              <Select value={selectedField.signerId} onValueChange={(v) => updateField(selectedField.id, { signerId: v })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {signers.map((s, i) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getSignerColor(i) }} />
                        <span>{s.name || `Signatário ${i + 1}`}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">X</label>
                <input
                  type="number"
                  className="w-full h-7 px-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={Math.round(selectedField.x)}
                  onChange={(e) => updateField(selectedField.id, { x: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Y</label>
                <input
                  type="number"
                  className="w-full h-7 px-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={Math.round(selectedField.y)}
                  onChange={(e) => updateField(selectedField.id, { y: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Largura</label>
                <input
                  type="number"
                  className="w-full h-7 px-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={Math.round(selectedField.width)}
                  onChange={(e) => updateField(selectedField.id, { width: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Altura</label>
                <input
                  type="number"
                  className="w-full h-7 px-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  value={Math.round(selectedField.height)}
                  onChange={(e) => updateField(selectedField.id, { height: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground">Página</label>
              <Select
                value={String(selectedField.page)}
                onValueChange={(v) => {
                  updateField(selectedField.id, { page: Number(v) });
                  setCurrentPage(Number(v));
                }}
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>Página {i + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="text-[10px] font-medium text-muted-foreground">Obrigatório</label>
              <button
                onClick={() => updateField(selectedField.id, { required: !selectedField.required })}
                className={cn(
                  'w-8 h-4 rounded-full transition-colors relative',
                  selectedField.required ? 'bg-primary' : 'bg-muted'
                )}
              >
                <div className={cn(
                  'w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform',
                  selectedField.required ? 'translate-x-4' : 'translate-x-0.5'
                )} />
              </button>
            </div>

            <div className="pt-2 space-y-1.5">
              <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => duplicateField(selectedField.id)}>
                <Copy className="w-3 h-3 mr-1" />Duplicar campo
              </Button>
              <Button variant="outline" size="sm" className="w-full h-7 text-xs text-destructive hover:text-destructive" onClick={() => deleteField(selectedField.id)}>
                <Trash2 className="w-3 h-3 mr-1" />Remover campo
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center text-muted-foreground">
              <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Selecione um campo para editar suas propriedades</p>
              <p className="text-[10px] mt-1 opacity-60">Ou clique em um campo da barra lateral para adicionar</p>
            </div>
          </div>
        )}

        {/* Page thumbnails */}
        <div className="p-3 border-t border-border space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Páginas</p>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: totalPages }, (_, i) => {
              const pageNum = i + 1;
              const pageFieldCount = fields.filter((f) => f.page === pageNum).length;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    'w-10 h-14 rounded border-2 flex flex-col items-center justify-center text-[9px] font-medium transition-all',
                    currentPage === pageNum
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/30'
                  )}
                >
                  <span>{pageNum}</span>
                  {pageFieldCount > 0 && (
                    <span className="text-[8px] bg-primary/20 text-primary rounded-full w-4 h-4 flex items-center justify-center mt-0.5">
                      {pageFieldCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
