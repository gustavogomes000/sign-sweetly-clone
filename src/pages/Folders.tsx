import { useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FolderOpen, MoreHorizontal, FileText, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useDocuments } from '@/hooks/useDocuments';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/documents/StatusBadge';

const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

export default function Folders() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(colors[0]);
  const { data: documents = [], isLoading } = useDocuments();

  // Build folders dynamically from document names (group by first word/prefix)
  const folderMap = new Map<string, { count: number; color: string }>();

  // Group documents by status as virtual folders
  const statusFolders = [
    { name: 'Rascunhos', status: 'draft', color: '#6b7280' },
    { name: 'Pendentes', status: 'pending', color: '#f59e0b' },
    { name: 'Assinados', status: 'signed', color: '#22c55e' },
    { name: 'Expirados', status: 'expired', color: '#ef4444' },
    { name: 'Cancelados', status: 'cancelled', color: '#8b5cf6' },
  ];

  const folders = statusFolders.map(sf => ({
    id: sf.status,
    name: sf.name,
    count: documents.filter(d => d.status === sf.status).length,
    color: sf.color,
  })).filter(f => f.count > 0);

  const docsInFolder = selectedFolder
    ? documents.filter(d => d.status === selectedFolder)
    : [];

  if (isLoading) {
    return (
      <>
        <AppHeader title="Pastas" subtitle="Organizando documentos..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader title="Pastas" subtitle={`${folders.length} pastas · ${documents.length} documentos`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex justify-between items-center">
          {selectedFolder && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedFolder(null)} className="text-muted-foreground">
              ← Todas as pastas
            </Button>
          )}
        </div>

        {!selectedFolder ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {folders.map((folder) => (
              <Card
                key={folder.id}
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 animate-fade-in"
                onClick={() => setSelectedFolder(folder.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${folder.color}20` }}>
                      <FolderOpen className="w-6 h-6" style={{ color: folder.color }} />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground">{folder.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{folder.count} documentos</p>
                </CardContent>
              </Card>
            ))}
            {folders.length === 0 && (
              <div className="col-span-full py-20 text-center text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum documento criado ainda</p>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <div className="p-4 border-b border-border">
              <h2 className="text-base font-semibold">
                {statusFolders.find(sf => sf.status === selectedFolder)?.name || selectedFolder}
              </h2>
              <p className="text-xs text-muted-foreground">{docsInFolder.length} documentos</p>
            </div>
            <div className="divide-y divide-border">
              {docsInFolder.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Pasta vazia</p>
                </div>
              )}
              {docsInFolder.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.signers.length > 0 && `${doc.signers.filter(s => s.status === 'signed').length}/${doc.signers.length} assinaturas`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={doc.status as any} />
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
