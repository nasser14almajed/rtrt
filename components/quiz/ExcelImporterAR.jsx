import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Info, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import * as XLSX from 'xlsx';

export default function ExcelImporterAR({ onImport, onClose }) {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedQuestions, setProcessedQuestions] = useState([]);
  const [error, setError] = useState(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setProcessedQuestions([]);
      setError(null);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        throw new Error("يجب أن يحتوي الملف على صف للعناوين وصف واحد على الأقل للبيانات.");
      }

      const headers = jsonData[0];
      const rows = jsonData.slice(1);

      // Map Arabic column names to their expected values
      const columnMapping = {
        'السؤال': 'question',
        'سؤال': 'question', 
        'النص': 'question',
        'النوع': 'type',
        'نوع': 'type',
        'النقاط': 'points',
        'نقاط': 'points',
        'الشرح': 'explanation',
        'شرح': 'explanation',
        'التفسير': 'explanation',
        'الخيار أ': 'option_a',
        'الخيار ب': 'option_b', 
        'الخيار ج': 'option_c',
        'الخيار د': 'option_d',
        'خيار أ': 'option_a',
        'خيار ب': 'option_b',
        'خيار ج': 'option_c', 
        'خيار د': 'option_d',
        'أ': 'option_a',
        'ب': 'option_b',
        'ج': 'option_c',
        'د': 'option_d',
        'الإجابة الصحيحة': 'correct_answer',
        'الإجابة': 'correct_answer',
        'إجابة صحيحة': 'correct_answer',
        'صحيح': 'correct_answer'
      };

      const mappedHeaders = headers.map(header => 
        columnMapping[header?.toString()?.trim()] || header?.toString()?.toLowerCase()?.trim()
      );

      const questions = rows.map((row, index) => {
        const questionData = {};
        mappedHeaders.forEach((header, i) => {
          if (header && row[i] !== undefined) {
            questionData[header] = row[i];
          }
        });

        if (!questionData.question || questionData.question.toString().trim() === '') {
          return null;
        }

        // Set default type
        let questionType = 'multiple_choice';
        if (questionData.type) {
          const typeStr = questionData.type.toString().toLowerCase();
          if (typeStr.includes('نص') || typeStr.includes('text')) {
            questionType = 'text';
          } else if (typeStr.includes('صح') || typeStr.includes('خطأ') || typeStr.includes('true') || typeStr.includes('false')) {
            questionType = 'true_false';
          } else if (typeStr.includes('مربع') || typeStr.includes('checkbox')) {
            questionType = 'checkbox';
          } else if (typeStr.includes('فراغ') || typeStr.includes('fill')) {
            questionType = 'fill_blank';
          }
        }

        // Process options
        const options = [];
        ['option_a', 'option_b', 'option_c', 'option_d'].forEach(key => {
          if (questionData[key] && questionData[key].toString().trim() !== '') {
            options.push(questionData[key].toString().trim());
          }
        });

        // Handle true/false questions
        if (questionType === 'true_false' && options.length === 0) {
          options.push('صحيح', 'خطأ');
        }

        // Process correct answers
        let correctAnswers = [];
        if (questionData.correct_answer) {
          const correctAnswer = questionData.correct_answer.toString().trim();
          
          // Handle letter answers (أ، ب، ج، د)
          if (['أ', 'ب', 'ج', 'د'].includes(correctAnswer)) {
            const optionIndex = ['أ', 'ب', 'ج', 'د'].indexOf(correctAnswer);
            if (optionIndex < options.length) {
              correctAnswers = [options[optionIndex]];
            }
          }
          // Handle English letter answers
          else if (['A', 'B', 'C', 'D'].includes(correctAnswer.toUpperCase())) {
            const optionIndex = correctAnswer.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
            if (optionIndex < options.length) {
              correctAnswers = [options[optionIndex]];
            }
          }
          // Handle number answers
          else if (['1', '2', '3', '4'].includes(correctAnswer)) {
            const optionIndex = parseInt(correctAnswer) - 1;
            if (optionIndex >= 0 && optionIndex < options.length) {
              correctAnswers = [options[optionIndex]];
            }
          }
          // Handle direct text answer
          else {
            correctAnswers = [correctAnswer];
          }
        }

        return {
          id: Date.now().toString() + Math.random() + index,
          question: questionData.question.toString().trim(),
          type: questionType,
          options: options,
          correct_answers: correctAnswers,
          explanation: questionData.explanation ? questionData.explanation.toString().trim() : "",
          points: questionData.points ? parseInt(questionData.points) || 1 : 1,
          required: true
        };
      }).filter(q => q !== null);

      if (questions.length === 0) {
        throw new Error("لم يتم العثور على أسئلة صالحة في الملف.");
      }

      setProcessedQuestions(questions);
    } catch (err) {
      console.error("Error processing file:", err);
      setError(err.message || "تعذر معالجة ملف Excel. يرجى التحقق من تنسيق الملف والمحاولة مرة أخرى.");
    }
    setIsProcessing(false);
  };

  const handleImport = () => {
    onImport(processedQuestions);
    onClose();
  };

  const downloadTemplate = () => {
    const templateData = [
      ['السؤال', 'النوع', 'الخيار أ', 'الخيار ب', 'الخيار ج', 'الخيار د', 'الإجابة الصحيحة', 'النقاط', 'الشرح'],
      ['ما هي عاصمة السعودية؟', 'multiple_choice', 'الرياض', 'جدة', 'الدمام', 'مكة', 'أ', '1', 'الرياض هي العاصمة الرسمية للمملكة العربية السعودية'],
      ['الأرض كروية الشكل', 'true_false', 'صحيح', 'خطأ', '', '', '1', '1', 'الأرض كروية تقريباً'],
      ['اذكر أكبر محيط في العالم', 'text', '', '', '', '', 'المحيط الهادئ', '2', 'المحيط الهادئ هو أكبر المحيطات']
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب الأسئلة');
    XLSX.writeFile(wb, 'قالب_أسئلة_الاختبار.xlsx');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-green-600" />
            استيراد الأسئلة من Excel
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>استيراد أسئلة Excel</AlertTitle>
            <AlertDescription>
              <p className="mb-3">ارفع ملف Excel يحتوي على أسئلة الاختبار. يجب أن يحتوي الملف على العناوين المطلوبة.</p>
              <div className="mt-4">
                <p className="font-medium mb-2">العناوين المطلوبة:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>السؤال</strong> - نص السؤال (مطلوب)</li>
                  <li><strong>النوع</strong> - نوع السؤال (اختياري، افتراضي: اختيار من متعدد)</li>
                  <li><strong>الخيار أ، الخيار ب، الخيار ج، الخيار د</strong> - خيارات الإجابة</li>
                  <li><strong>الإجابة الصحيحة</strong> - الإجابة الصحيحة (أ، ب، ج، د أو النص المباشر)</li>
                  <li><strong>النقاط</strong> - نقاط السؤال (اختياري، افتراضي: 1)</li>
                  <li><strong>الشرح</strong> - شرح الإجابة (اختياري)</li>
                </ul>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                  <Download className="w-4 h-4" />
                  تحميل قالب نموذجي
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>خطأ في الاستيراد</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="file-upload">اختر ملف Excel</Label>
            <div className="mt-2 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mb-4">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                </div>
                <span className="text-lg font-medium text-slate-700 mb-1">
                  اضغط لاختيار ملف Excel
                </span>
                <span className="text-sm text-slate-500">
                  ملفات Excel فقط (.xlsx, .xls)
                </span>
              </label>
            </div>
            
            {file && (
              <div className="mt-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-green-800">{file.name}</span>
                    <p className="text-sm text-green-600">
                      الحجم: {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {file && !processedQuestions.length && !error && (
            <Button
              onClick={processFile}
              disabled={isProcessing}
              className="w-full bg-green-600 hover:bg-green-700 gap-2 py-3"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  جاري استخراج الأسئلة من Excel...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  استخراج الأسئلة
                </>
              )}
            </Button>
          )}

          {processedQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <span className="font-medium text-green-800">
                    تم استخراج {processedQuestions.length} سؤال بنجاح
                  </span>
                  <p className="text-sm text-green-600 mt-1">
                    راجع الأسئلة أدناه قبل الاستيراد
                  </p>
                </div>
              </div>
              
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <div className="grid gap-2 p-3">
                  {processedQuestions.slice(0, 10).map((q, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-lg border">
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 mb-1 line-clamp-2">
                            {q.question}
                          </p>
                          {q.options.length > 0 && (
                            <div className="text-xs text-slate-600">
                              <span className="font-medium">الخيارات:</span> {q.options.slice(0, 2).join(', ')}
                              {q.options.length > 2 && ` (+${q.options.length - 2} أكثر)`}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              {q.type.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-slate-500">
                              {q.points} نقطة
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {processedQuestions.length > 10 && (
                    <div className="text-center text-sm text-slate-500 p-3 border-t">
                      ...و {processedQuestions.length - 10} سؤال أخر
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button 
            onClick={handleImport}
            disabled={!processedQuestions.length}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            <Upload className="w-4 h-4" />
            استيراد {processedQuestions.length > 0 ? processedQuestions.length : ''} سؤال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}