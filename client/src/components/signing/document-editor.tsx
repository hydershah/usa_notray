import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Save,
  Download,
  Upload,
  Undo,
  Redo,
  Type,
  Image,
  FileText,
  Printer,
  Share2,
  Eye,
  Edit3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DocumentEditorProps {
  documentId?: string;
  initialContent?: string;
  jobId: number;
  onSave: (content: string) => void;
  readOnly?: boolean;
}

export function DocumentEditor({ 
  documentId, 
  initialContent = '', 
  jobId, 
  onSave, 
  readOnly = false 
}: DocumentEditorProps) {
  const { toast } = useToast();
  const [content, setContent] = useState(initialContent);
  const [isEditing, setIsEditing] = useState(!readOnly);
  const [fontSize, setFontSize] = useState(12);
  const [fontFamily, setFontFamily] = useState('Times New Roman');
  const [documentTitle, setDocumentTitle] = useState('Real Estate Purchase Agreement');
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<string[]>([initialContent]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      setHistory([initialContent]);
    }
  }, [initialContent]);

  const addToHistory = (newContent: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newContent);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    addToHistory(newContent);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setContent(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setContent(history[historyIndex + 1]);
    }
  };

  const applyFormatting = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML;
      handleContentChange(newContent);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      toast({
        title: "Document saved",
        description: "Your changes have been saved successfully",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Unable to save document changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Document downloaded",
      description: "Document has been saved to your device",
    });
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        handleContentChange(text);
        toast({
          title: "Document uploaded",
          description: "File content has been loaded",
        });
      };
      reader.readAsText(file);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${documentTitle}</title>
            <style>
              body { 
                font-family: ${fontFamily}; 
                font-size: ${fontSize}pt; 
                line-height: 1.6;
                margin: 1in;
              }
              @media print {
                body { margin: 0; }
              }
            </style>
          </head>
          <body>${content}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const formatToolbarButton = (command: string, icon: React.ReactNode, value?: string) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => applyFormatting(command, value)}
      disabled={!isEditing}
    >
      {icon}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Document Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <FileText className="w-6 h-6" />
              <div>
                <Input
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="text-lg font-semibold border-none p-0 focus:ring-0"
                  disabled={readOnly}
                />
                <p className="text-sm text-gray-500">Job #{jobId} Document</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={isEditing ? "default" : "secondary"}>
                {isEditing ? "Editing" : "View Only"}
              </Badge>
              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Toolbar */}
      {isEditing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* File Operations */}
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="w-4 h-4 mr-1" />
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" />
                  Upload
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-1" />
                  Print
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.html,.rtf"
                  onChange={handleUpload}
                  className="hidden"
                />
              </div>

              <Separator />

              {/* Formatting Tools */}
              <div className="flex items-center space-x-2 flex-wrap gap-2">
                <div className="flex items-center space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                  >
                    <Undo className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                  >
                    <Redo className="w-4 h-4" />
                  </Button>
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center space-x-1">
                  {formatToolbarButton('bold', <Bold className="w-4 h-4" />)}
                  {formatToolbarButton('italic', <Italic className="w-4 h-4" />)}
                  {formatToolbarButton('underline', <Underline className="w-4 h-4" />)}
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center space-x-1">
                  {formatToolbarButton('justifyLeft', <AlignLeft className="w-4 h-4" />)}
                  {formatToolbarButton('justifyCenter', <AlignCenter className="w-4 h-4" />)}
                  {formatToolbarButton('justifyRight', <AlignRight className="w-4 h-4" />)}
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center space-x-2">
                  <Label htmlFor="font-family" className="text-sm">Font:</Label>
                  <select
                    id="font-family"
                    value={fontFamily}
                    onChange={(e) => {
                      setFontFamily(e.target.value);
                      applyFormatting('fontName', e.target.value);
                    }}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <Label htmlFor="font-size" className="text-sm">Size:</Label>
                  <select
                    id="font-size"
                    value={fontSize}
                    onChange={(e) => {
                      setFontSize(parseInt(e.target.value));
                      applyFormatting('fontSize', e.target.value);
                    }}
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="10">10pt</option>
                    <option value="12">12pt</option>
                    <option value="14">14pt</option>
                    <option value="16">16pt</option>
                    <option value="18">18pt</option>
                    <option value="20">20pt</option>
                  </select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Editor */}
      <Card>
        <CardContent className="pt-6">
          <div
            ref={editorRef}
            contentEditable={isEditing}
            onInput={(e) => handleContentChange(e.currentTarget.innerHTML)}
            className={`min-h-96 p-6 border rounded-lg bg-white ${
              isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'cursor-default'
            }`}
            style={{
              fontFamily,
              fontSize: `${fontSize}pt`,
              lineHeight: 1.6,
            }}
            suppressContentEditableWarning={true}
            dangerouslySetInnerHTML={{ __html: content }}
          />
          
          {!isEditing && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 flex items-center">
                <Eye className="w-4 h-4 mr-2" />
                Document is in view-only mode. Click the edit button to make changes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Statistics */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">
                {content.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0).length}
              </p>
              <p className="text-sm text-gray-500">Words</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {content.replace(/<[^>]*>/g, '').length}
              </p>
              <p className="text-sm text-gray-500">Characters</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">
                {content.split('\n').length}
              </p>
              <p className="text-sm text-gray-500">Lines</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {Math.ceil(content.replace(/<[^>]*>/g, '').split(/\s+/).length / 250)}
              </p>
              <p className="text-sm text-gray-500">Pages</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}