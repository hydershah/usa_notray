import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  Tag, 
  Download, 
  Save, 
  ArrowLeft,
  Plus,
  Trash2,
  Edit3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

interface DocumentTag {
  id: string;
  type: 'signature' | 'initial' | 'date' | 'text' | 'checkbox';
  x: number;
  y: number;
  text: string;
  instruction: string;
  required: boolean;
  assignedTo?: string;
}

export default function DocumentTagging() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [placedTags, setPlacedTags] = useState<DocumentTag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [editingTag, setEditingTag] = useState<DocumentTag | null>(null);
  const [tagText, setTagText] = useState('');
  const [tagInstruction, setTagInstruction] = useState('');

  // Sample document content
  const documentContent = `REAL ESTATE PURCHASE AGREEMENT

Property Address: 1425 Oak Street, Unit 302, Dallas, TX 75201
Purchase Price: $425,000.00
Closing Date: June 30, 2025

BUYER INFORMATION:
Name: Michael Thompson & Lisa Thompson
Address: 456 Elm Avenue, Richardson, TX 75080
Phone: (972) 555-0123
Email: mthompson@email.com

SELLER INFORMATION:
Name: Sarah Johnson
Address: 789 Pine Street, Plano, TX 75023
Phone: (214) 555-0987
Email: s.johnson@email.com

TERMS AND CONDITIONS:
1. Purchase Price: The total purchase price for the Property is $425,000.00
2. Earnest Money: Buyer has deposited $5,000 as earnest money
3. Financing: This sale is contingent upon Buyer obtaining financing
4. Inspection: Buyer has 10 days to complete property inspection
5. Closing: Closing shall occur on or before June 30, 2025

SIGNATURES:
By signing below, all parties agree to the terms and conditions set forth in this agreement.

Buyer Signature: _________________________ Date: _________
Michael Thompson

Buyer Signature: _________________________ Date: _________
Lisa Thompson

Seller Signature: _________________________ Date: _________
Sarah Johnson

Notary Acknowledgment:
State of Texas
County of Dallas

I hereby acknowledge that the above signatures were made in my presence.

Notary Signature: _________________________ Date: _________
Notary Stamp: [                    ]`;

  const addTag = (tagData: any, x: number, y: number) => {
    const newTag: DocumentTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: tagData.type,
      x,
      y,
      text: tagData.text || '',
      instruction: tagData.instruction || `Please ${tagData.type} here`,
      required: true,
      assignedTo: tagData.assignedTo || 'signer'
    };
    setPlacedTags(prev => [...prev, newTag]);
  };

  const updateTagPosition = (tagId: string, x: number, y: number) => {
    setPlacedTags(prev => prev.map(tag => 
      tag.id === tagId ? { ...tag, x, y } : tag
    ));
  };

  const deleteTag = (tagId: string) => {
    setPlacedTags(prev => prev.filter(tag => tag.id !== tagId));
    setSelectedTag(null);
  };

  const startEditingTag = (tag: DocumentTag) => {
    setEditingTag(tag);
    setTagText(tag.text);
    setTagInstruction(tag.instruction);
  };

  const saveTagEdits = () => {
    if (editingTag) {
      setPlacedTags(prev => prev.map(tag => 
        tag.id === editingTag.id 
          ? { ...tag, text: tagText, instruction: tagInstruction }
          : tag
      ));
      setEditingTag(null);
      setTagText('');
      setTagInstruction('');
      toast({
        title: "Tag updated",
        description: "Tag text and instruction have been saved"
      });
    }
  };

  const saveTaggedDocument = async () => {
    // In a real app, save tags to backend
    const tagData = {
      jobId: new URLSearchParams(window.location.search).get('jobId'),
      tags: placedTags,
      documentContent,
      savedAt: new Date().toISOString()
    };

    // Mock save
    localStorage.setItem(`document-tags-${tagData.jobId}`, JSON.stringify(tagData));
    
    toast({
      title: "Document tagged successfully",
      description: `Saved ${placedTags.length} tags. Ready for live signing session.`,
    });
  };

  const tagTypes = [
    { type: 'signature', label: 'Signature', color: 'bg-blue-100 border-blue-300', icon: '✍️' },
    { type: 'initial', label: 'Initial', color: 'bg-green-100 border-green-300', icon: '🔤' },
    { type: 'date', label: 'Date', color: 'bg-purple-100 border-purple-300', icon: '📅' },
    { type: 'text', label: 'Text Field', color: 'bg-orange-100 border-orange-300', icon: '📝' },
    { type: 'checkbox', label: 'Checkbox', color: 'bg-gray-100 border-gray-300', icon: '☑️' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setLocation('/jobs')}
                className="hover:bg-gray-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Jobs
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Document Tagging</h1>
                <p className="text-gray-600">Add tags to guide signers during the live session</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {placedTags.length} tags placed
              </Badge>
              <Button onClick={saveTaggedDocument} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Save Tags
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel - Tag Palette */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tag Palette</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {tagTypes.map((tagType) => (
                  <div key={tagType.type}>
                    <Label className="text-xs text-gray-600">{tagType.label}</Label>
                    <div
                      className={`border-2 rounded p-3 cursor-move hover:shadow-md transition-shadow ${tagType.color}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', JSON.stringify({
                          type: tagType.type,
                          text: tagType.label,
                          instruction: `Please ${tagType.type} here`,
                          assignedTo: 'signer'
                        }));
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{tagType.icon}</span>
                        <span className="text-sm font-medium">{tagType.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Drag to document
                      </p>
                    </div>
                  </div>
                ))}

                {/* Tag Editor */}
                {editingTag && (
                  <div className="mt-6 p-3 border rounded bg-white">
                    <Label className="text-sm font-semibold">Edit Tag</Label>
                    <div className="space-y-2 mt-2">
                      <div>
                        <Label className="text-xs">Display Text</Label>
                        <Input
                          value={tagText}
                          onChange={(e) => setTagText(e.target.value)}
                          placeholder="Tag text"
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Instruction</Label>
                        <Textarea
                          value={tagInstruction}
                          onChange={(e) => setTagInstruction(e.target.value)}
                          placeholder="Instructions for signer"
                          className="text-xs h-16"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveTagEdits} className="text-xs">
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setEditingTag(null)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - Document Viewer */}
          <div className="col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Real Estate Purchase Agreement
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-full">
                <div 
                  className={`h-96 overflow-y-auto border-t relative bg-white transition-colors ${
                    isDragOver ? 'bg-orange-50 border-orange-300' : ''
                  }`}
                  style={{ height: 'calc(100vh - 300px)' }}
                  data-document-container
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setIsDragOver(false);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const rect = e.currentTarget.getBoundingClientRect();
                    const scrollTop = e.currentTarget.scrollTop;
                    
                    const x = Math.max(0, e.clientX - rect.left - 10);
                    const y = Math.max(0, e.clientY - rect.top + scrollTop - 10);
                    
                    addTag(data, x, y);
                    
                    toast({
                      title: "Tag placed",
                      description: `${data.text} tag added to document`,
                    });
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setSelectedTag(null);
                    }
                  }}
                >
                  <div className="p-6 bg-white min-h-full">
                    <div className="max-w-4xl mx-auto">
                      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                        {documentContent}
                      </div>
                    </div>
                  </div>

                  {/* Rendered Tags */}
                  {placedTags.map((tag) => {
                    const isSelected = selectedTag === tag.id;
                    const tagType = tagTypes.find(t => t.type === tag.type);
                    
                    return (
                      <div
                        key={tag.id}
                        className={`absolute cursor-move border-2 rounded px-2 py-1 text-xs font-medium ${
                          tagType?.color || 'bg-gray-100 border-gray-300'
                        } ${
                          isSelected ? 'ring-2 ring-orange-500 ring-offset-2' : 'hover:ring-1 hover:ring-gray-300'
                        }`}
                        style={{
                          left: `${tag.x}px`,
                          top: `${tag.y}px`,
                          zIndex: isSelected ? 20 : 10,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTag(tag.id);
                        }}
                        onMouseDown={(e) => {
                          if (e.button === 0) {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedTag(tag.id);
                            
                            const startMouseX = e.clientX;
                            const startMouseY = e.clientY;
                            const startTagX = tag.x;
                            const startTagY = tag.y;
                            
                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              const deltaX = moveEvent.clientX - startMouseX;
                              const deltaY = moveEvent.clientY - startMouseY;
                              
                              const newX = Math.max(0, startTagX + deltaX);
                              const newY = Math.max(0, startTagY + deltaY);
                              
                              updateTagPosition(tag.id, newX, newY);
                            };
                            
                            const handleMouseUp = () => {
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                            };
                            
                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                          }
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <span>{tagType?.icon}</span>
                          <span>{tag.text}</span>
                        </div>
                        
                        {/* Action buttons for selected tag */}
                        {isSelected && (
                          <div className="absolute -top-8 left-0 flex gap-1">
                            <button
                              className="w-6 h-6 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingTag(tag);
                              }}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              className="w-6 h-6 bg-red-500 text-white rounded text-xs hover:bg-red-600 flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTag(tag.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Tag List */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Placed Tags</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="space-y-2">
                  {placedTags.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-4">
                      No tags placed yet. Drag tags from the left panel to the document.
                    </p>
                  ) : (
                    placedTags.map((tag) => {
                      const tagType = tagTypes.find(t => t.type === tag.type);
                      return (
                        <div 
                          key={tag.id}
                          className={`p-2 border rounded text-xs cursor-pointer ${
                            selectedTag === tag.id ? 'bg-orange-50 border-orange-300' : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedTag(tag.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span>{tagType?.icon}</span>
                            <span className="font-medium">{tag.text}</span>
                          </div>
                          <p className="text-gray-600 mt-1">{tag.instruction}</p>
                          <div className="flex items-center justify-between mt-1">
                            <Badge variant="outline" className="text-xs">
                              {tag.assignedTo}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              ({tag.x}, {tag.y})
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {placedTags.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs text-red-600 hover:text-red-700"
                      onClick={() => {
                        setPlacedTags([]);
                        setSelectedTag(null);
                        toast({
                          title: "All tags cleared",
                          description: "All tags have been removed from the document",
                        });
                      }}
                    >
                      Clear All Tags
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}