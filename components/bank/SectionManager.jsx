
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  Upload,
  Database,
  FolderOpen,
  FileText
} from "lucide-react";
import { motion } from "framer-motion";

const colorOptions = {
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  green: "bg-green-100 text-green-800 border-green-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  red: "bg-red-100 text-red-800 border-red-200",
  pink: "bg-pink-100 text-pink-800 border-pink-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  teal: "bg-teal-100 text-teal-800 border-teal-200"
};

export default function SectionManager({ 
  sections, 
  questionCounts,
  onCreateSection, 
  onUpdateSection, 
  onDeleteSection,
  onOpenImport 
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [newSection, setNewSection] = useState({
    name: "",
    description: "",
    color: "blue"
  });

  const resetForm = () => {
    setNewSection({
      name: "",
      description: "",
      color: "blue"
    });
  };

  const handleSave = async () => {
    if (!newSection.name.trim()) {
      alert("Please enter a section name.");
      return;
    }

    const sectionData = {
      ...newSection,
      order: editingSection ? editingSection.order : sections.length
    };

    if (editingSection) {
      await onUpdateSection(editingSection.id, sectionData);
    } else {
      await onCreateSection(sectionData);
    }

    setIsCreating(false);
    setEditingSection(null);
    resetForm();
  };

  const handleEdit = (section) => {
    setNewSection({
      name: section.name,
      description: section.description || "",
      color: section.color || "blue"
    });
    setEditingSection(section);
    setIsCreating(true);
  };

  const handleDelete = async (section) => {
    if (!confirm(`Are you sure you want to delete "${section.name}"? Questions in this section will become uncategorized.`)) {
      return;
    }
    await onDeleteSection(section.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Organize Questions by Subject</h3>
        <Button
          onClick={() => {
            resetForm();
            setIsCreating(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Section
        </Button>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-lg">
          <FolderOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-2">No Sections Yet</h3>
          <p className="text-slate-500 mb-4">
            Create sections to organize your questions by subject (Math, English, Science, etc.)
          </p>
          <Button
            onClick={() => {
              resetForm();
              setIsCreating(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create First Section
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section, index) => {
            const count = questionCounts[section.id] || 0;
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle className={`text-lg font-bold ${colorOptions[section.color]?.replace('bg-', 'text-').replace('-100', '-800')}`}>
                        {section.name}
                      </CardTitle>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onOpenImport(section.id)}>
                            <Upload className="w-4 h-4 mr-2" />
                            Import to Section
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(section)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDelete(section)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-sm text-slate-500 pt-1 line-clamp-2 min-h-[40px]">
                      {section.description || "No description."}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-end">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <Badge variant="outline" className={`${colorOptions[section.color]}`}>
                        <FileText className="w-3 h-3 mr-1.5" />
                        {count} {count === 1 ? 'Question' : 'Questions'}
                      </Badge>
                      <Badge variant="outline">
                        ID: {section.id.slice(-6)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? 'Edit Section' : 'Create New Section'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Section Name</label>
              <Input
                value={newSection.name}
                onChange={(e) => setNewSection(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Mathematics, English, Science..."
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description (Optional)</label>
              <Textarea
                value={newSection.description}
                onChange={(e) => setNewSection(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this section..."
                className="mt-2"
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Color Theme</label>
              <Select
                value={newSection.color}
                onValueChange={(value) => setNewSection(prev => ({ ...prev, color: value }))}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(colorOptions).map(([color, className]) => (
                    <SelectItem key={color} value={color}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border ${className}`}></div>
                        <span className="capitalize">{color}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreating(false);
              setEditingSection(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              {editingSection ? 'Update' : 'Create'} Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
