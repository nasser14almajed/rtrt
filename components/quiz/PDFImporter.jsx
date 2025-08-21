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
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function PDFImporter({ onImport, onClose }) {
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
      const { file_url } = await UploadFile({ file });

      const result = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  options: { 
                    type: "array",
                    items: { type: "string" }
                  },
                  correct_answer: { type: "string" },
                  explanation: { type: "string" },
                  points: { type: "number" }
                }
              }
            }
          },
          required: ["questions"]
        }
      });

      if (result.status === "success" && result.output?.questions) {
        const questions = result.output.questions;
        
        if (!Array.isArray(questions) || questions.length === 0) {
          throw new Error("No questions found in the PDF. Please ensure your PDF contains properly formatted questions.");
        }

        const processed = questions.map((q, index) => {
          let questionType = "multiple_choice";
          let options = q.options || [];
          
          // Auto-detect question type
          if (options.length === 2 && 
              (options.some(opt => opt.toLowerCase().includes('true')) || 
               options.some(opt => opt.toLowerCase().includes('false')))) {
            questionType = "true_false";
          } else if (options.length === 0) {
            questionType = "text";
          }
          
          let correctAnswers = [];
          if (q.correct_answer) {
            // Handle letter answers (A, B, C, D)
            if (['A', 'B', 'C', 'D'].includes(q.correct_answer.toUpperCase())) {
              const index = q.correct_answer.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
              if (index < options.length) {
                correctAnswers = [options[index]];
              }
            }
            // Handle number answers (1, 2, 3, 4)
            else if (['1', '2', '3', '4'].includes(q.correct_answer)) {
              const index = parseInt(q.correct_answer) - 1;
              if (index >= 0 && index < options.length) {
                correctAnswers = [options[index]];
              }
            }
            // Handle direct text answer
            else {
              correctAnswers = [q.correct_answer];
            }
          }
          
          return {
            id: Date.now().toString() + Math.random() + index,
            question: q.question || `Question ${index + 1}`,
            type: questionType,
            options: options,
            correct_answers: correctAnswers,
            explanation: q.explanation || "",
            points: q.points || 1,
            required: true
          };
        });

        const validQuestions = processed.filter(q => 
          q.question && q.question.trim().length > 0 && !q.question.startsWith('Question ')
        );
        
        if (validQuestions.length === 0) {
          throw new Error("No valid questions found. Please ensure your PDF contains properly formatted questions.");
        }

        setProcessedQuestions(validQuestions);
      } else {
        throw new Error(result.details || "Could not extract questions from PDF. Please check the file format.");
      }
    } catch (err) {
      console.error("Error processing file:", err);
      setError(err.message || "Could not process the PDF file. Please check your file format and try again.");
    }
    setIsProcessing(false);
  };

  const handleImport = () => {
    onImport(processedQuestions);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-red-600" />
            Import Questions from PDF
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>PDF Question Import</AlertTitle>
            <AlertDescription>
              <p className="mb-3">Upload a PDF file containing quiz questions. The AI will automatically extract and format the questions.</p>
              <div className="mt-4">
                <p className="font-medium mb-2">Best Results:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Questions should be clearly numbered (1., 2., etc.)</li>
                  <li>Multiple choice options should be labeled (A., B., C., D.)</li>
                  <li>Include answer keys if available</li>
                  <li>Use clear formatting and readable fonts</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="file-upload">Select PDF File</Label>
            <div className="mt-2 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
              <input
                id="file-upload"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-red-600" />
                </div>
                <span className="text-lg font-medium text-slate-700 mb-1">
                  Click to select a PDF file
                </span>
                <span className="text-sm text-slate-500">
                  PDF files only (.pdf)
                </span>
              </label>
            </div>
            
            {file && (
              <div className="mt-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-green-800">{file.name}</span>
                    <p className="text-sm text-green-600">
                      Size: {(file.size / 1024).toFixed(1)} KB
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
              className="w-full bg-red-600 hover:bg-red-700 gap-2 py-3"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Extracting Questions from PDF...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Extract Questions
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
                    Successfully extracted {processedQuestions.length} questions
                  </span>
                  <p className="text-sm text-green-600 mt-1">
                    Review the questions below before importing
                  </p>
                </div>
              </div>
              
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <div className="grid gap-2 p-3">
                  {processedQuestions.slice(0, 10).map((q, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-lg border">
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 mb-1 line-clamp-2">
                            {q.question}
                          </p>
                          {q.options.length > 0 && (
                            <div className="text-xs text-slate-600">
                              <span className="font-medium">Options:</span> {q.options.slice(0, 2).join(', ')}
                              {q.options.length > 2 && ` (+${q.options.length - 2} more)`}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                              {q.type.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-slate-500">
                              {q.points} point{q.points !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {processedQuestions.length > 10 && (
                    <div className="text-center text-sm text-slate-500 p-3 border-t">
                      ...and {processedQuestions.length - 10} more questions
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={!processedQuestions.length}
            className="bg-red-600 hover:bg-red-700 gap-2"
          >
            <Upload className="w-4 h-4" />
            Import {processedQuestions.length > 0 ? processedQuestions.length : ''} Questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}