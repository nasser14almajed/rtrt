
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
  FolderOpen,
  Palette,
  Upload,
  MoreVertical,
  FileText
} from "lucide-react";
import { motion } from "framer-motion";

const colorOptions = [
  { value: "blue", label: "أزرق", class: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "green", label: "أخضر", class: "bg-green-100 text-green-800 border-green-200" },
  { value: "purple", label: "بنفسجي", class: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "orange", label: "برتقالي", class: "bg-orange-100 text-orange-800 border-orange-200" },
  { value: "red", label: "أحمر", class: "bg-red-100 text-red-800 border-red-200" },
  { value: "pink", label: "وردي", class: "bg-pink-100 text-pink-800 border-pink-200" },
  { value: "indigo", label: "نيلي", class: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { value: "teal", label: "أخضر مزرق", class: "bg-teal-100 text-teal-800 border-teal-200" }
];

export default function SectionManagerAR({ 
  sections, 
  questionCounts,
  onCreateSection, 
  onUpdateSection, 
  onDeleteSection,
  onOpenImport 
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "blue"
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      color: "blue"
    });
    setEditingSection(null);
  };

  const handleCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const handleEdit = (section) => {
    setFormData({
      name: section.name,
      description: section.description || "",
      color: section.color || "blue"
    });
    setEditingSection(section);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    const sectionData = {
      ...formData,
      order: editingSection ? editingSection.order : sections.length
    };

    try {
      if (editingSection) {
        await onUpdateSection(editingSection.id, sectionData);
      } else {
        await onCreateSection(sectionData);
      }
      
      setShowDialog(false);
      resetForm();
    } catch (error) {
      console.error("Error saving section:", error);
    }
  };

  const handleDelete = async (section) => {
    if (!confirm(`هل أنت متأكد من حذف القسم "${section.name}"؟ سيتم نقل جميع الأسئلة في هذا القسم إلى 'غير مصنف'.`)) {
      return;
    }

    try {
      await onDeleteSection(section.id);
    } catch (error) {
      console.error("Error deleting section:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">إدارة الأقسام</h3>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          قسم جديد
        </Button>
      </div>

      {sections.length === 0 ? (
        <div className="text-center py-8">
          <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-slate-600 mb-2">لا توجد أقسام بعد</h4>
          <p className="text-slate-500 mb-4">أنشئ أقساماً لتنظيم أسئلتك بشكل أفضل</p>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            إنشاء قسم جديد
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section, index) => {
            const count = questionCounts[section.id] || 0;
            const sectionColorClass = colorOptions.find(c => c.value === section.color)?.class || '';
            const cardTitleColorClass = sectionColorClass.replace('bg-', 'text-').replace('-100', '-800');

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
                      <CardTitle className={`text-lg font-bold ${cardTitleColorClass}`}>
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
                            <Upload className="w-4 h-4 ml-2" />
                            استيراد إلى القسم
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(section)}>
                            <Edit className="w-4 h-4 ml-2" />
                            تعديل
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(section)} className="text-red-600">
                            <Trash2 className="w-4 h-4 ml-2" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-sm text-slate-500 pt-1 line-clamp-2 min-h-[40px]">
                      {section.description || "لا يوجد وصف."}
                    </p>
                  </CardHeader>
                  <CardContent className="flex-grow flex flex-col justify-end">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <Badge variant="outline" className={`${sectionColorClass}`}>
                        <FileText className="w-3 h-3 ml-1.5" />
                        {count} {count === 1 ? 'سؤال' : 'أسئلة'}
                      </Badge>
                      <Badge variant="outline">
                        المعرف: {section.id.slice(-6)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSection ? 'تعديل القسم' : 'قسم جديد'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">اسم القسم</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="أدخل اسم القسم..."
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">الوصف (اختياري)</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="وصف مختصر للقسم..."
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">اللون</label>
              <Select
                value={formData.color}
                onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 ${color.class}`}></div>
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Palette className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium">معاينة</span>
              </div>
              <Badge className={colorOptions.find(c => c.value === formData.color)?.class || colorOptions[0].class}>
                <FolderOpen className="w-3 h-3 mr-1" />
                {formData.name || 'اسم القسم'}
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDialog(false);
              resetForm();
            }}>
              إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {editingSection ? 'تحديث' : 'إنشاء'} القسم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
