import React, { useState } from "react";
import { UploadFile, ExtractDataFromUploadedFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, Loader2, CheckCircle } from "lucide-react";

export default function PDFImporterAR({ onImport, onClose }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadedFileUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await UploadFile({ file });
      setUploadedFileUrl(result.file_url);
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("خطأ في رفع الملف. يرجى المحاولة مرة أخرى.");
    }
    setIsUploading(false);
  };

  const handleExtract = async () => {
    if (!uploadedFileUrl) return;

    setIsExtracting(true);
    try {
      const jsonSchema = {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string", description: "نص السؤال باللغة العربية" },
                type: { 
                  type: "string", 
                  enum: ["multiple_choice", "checkbox", "true_false", "text", "fill_blank"],
                  description: "نوع السؤال"
                },
                options: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "خيارات الإجابة (للأسئلة متعددة الخيارات وصناديق الاختيار)"
                },
                correct_answers: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "الإجابات الصحيحة"
                },
                explanation: { 
                  type: "string", 
                  description: "شرح الإجابة الصحيحة"
                },
                category: {
                  type: "string",
                  description: "فئة السؤال"
                },
                difficulty: {
                  type: "string",
                  enum: ["easy", "medium", "hard"],
                  description: "مستوى صعوبة السؤال"
                },
                points: { 
                  type: "number", 
                  default: 1,
                  description: "نقاط السؤال"
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "علامات لتنظيم السؤال"
                }
              },
              required: ["question", "type"]
            }
          }
        }
      };

      const result = await ExtractDataFromUploadedFile({
        file_url: uploadedFileUrl,
        json_schema: jsonSchema
      });

      if (result.status === "success" && result.output?.questions) {
        const questions = result.output.questions.map(q => ({
          ...q,
          options: q.options || [],
          correct_answers: q.correct_answers || [],
          explanation: q.explanation || "",
          category: q.category || "مستورد من PDF",
          difficulty: q.difficulty || "medium",
          points: q.points || 1,
          tags: q.tags || [],
          section_id: "" // Will be assigned later if needed
        }));

        onImport(questions);
        onClose();
      } else {
        alert("فشل في استخراج الأسئلة من الملف. تأكد من أن الملف يحتوي على أسئلة بتنسيق مناسب.");
      }
    } catch (error) {
      console.error("Error extracting questions:", error);
      alert("خطأ في استخراج الأسئلة. يرجى التحقق من تنسيق الملف والمحاولة مرة أخرى.");
    }
    setIsExtracting(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-red-600" />
            استيراد إلى بنك الأسئلة
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="font-semibold mb-2">استخراج الأسئلة من PDF</h3>
            <p className="text-sm text-slate-600">
              ارفع ملف PDF يحتوي على أسئلة وسنقوم باستخراجها وإضافتها إلى بنك الأسئلة
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="pdf-file" className="text-sm font-medium">
                اختر ملف PDF
              </Label>
              <input
                id="pdf-file"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="mt-2 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {file && !uploadedFileUrl && (
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full gap-2"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isUploading ? 'جاري الرفع...' : 'رفع الملف'}
              </Button>
            )}

            {uploadedFileUrl && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-green-800">تم رفع الملف بنجاح</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">نصائح للحصول على أفضل النتائج:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• تأكد من وضوح النص في ملف PDF</li>
              <li>• قم بتنسيق الأسئلة بشكل واضح</li>
              <li>• تأكد من وجود خيارات واضحة للأسئلة متعددة الخيارات</li>
              <li>• سيتم إضافة الأسئلة إلى بنك الأسئلة للاستخدام في اختبارات متعددة</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            onClick={handleExtract}
            disabled={!uploadedFileUrl || isExtracting}
            className="bg-red-600 hover:bg-red-700 gap-2"
          >
            {isExtracting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {isExtracting ? 'جاري الاستخراج...' : 'استخراج إلى البنك'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}