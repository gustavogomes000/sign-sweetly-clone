import { AppHeader } from '@/components/layout/AppHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockFolders, mockDocuments } from '@/data/mockData';
import { Plus, FolderOpen, MoreHorizontal, FileText } from 'lucide-react';
import { useState } from 'react';
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
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

export default function Folders() {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(colors[0]);

  const docsInFolder = selectedFolder
    ? mockDocuments.filter((d) => d.folder === selectedFolder)
    : [];

  return (
    <>
      <AppHeader title="Pastas" subtitle={`${mockFolders.length} pastas`} />
      <div className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex justify-between items-center">
          {selectedFolder && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedFolder(null)} className="text-muted-foreground">
              ← Todas as pastas
            </Button>
          )}
          <div className="ml-auto">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova pasta</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Criar nova pasta</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Nome da pasta</Label>
                    <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Ex: Contratos 2026" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex gap-2">
                      {colors.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewFolderColor(c)}
                          className={cn('w-8 h-8 rounded-full transition-all', newFolderColor === c && 'ring-2 ring-offset-2 ring-primary')}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <Button className="w-full">Criar pasta</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {!selectedFolder ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {mockFolders.map((folder) => (
              <Card
                key={folder.id}
                className="cursor-pointer hover:shadow-md transition-all hover:border-primary/30 animate-fade-in"
                onClick={() => setSelectedFolder(folder.name)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${folder.color}20` }}>
                      <FolderOpen className="w-6 h-6" style={{ color: folder.color }} />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Renomear</DropdownMenuItem>
                        <DropdownMenuItem>Alterar cor</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-sm font-medium text-foreground">{folder.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{folder.count} documentos</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <div className="p-4 border-b border-border">
              <h2 className="text-base font-semibold">{selectedFolder}</h2>
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
                <div key={doc.id} className="flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
