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
                  category: { type: "string" },
                  difficulty: { type: "string" },
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
            question: q.question || `Question ${index + 1}`,
            type: questionType,
            options: options,
            correct_answers: correctAnswers,
            explanation: q.explanation || "",
            category: q.category || "Imported",
            difficulty: q.difficulty || "medium",
            points: q.points || 1,
            tags: q.category ? [q.category] : []
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <p className="mb-2">Upload a PDF file containing quiz questions. The AI will automatically extract and format the questions for your question bank.</p>
              <div className="mt-3">
                <p className="font-medium mb-2">For best results:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Questions should be clearly numbered</li>
                  <li>Multiple choice options should be labeled (A, B, C, D)</li>
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
            <div className="mt-2 border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
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
                <FileText className="w-12 h-12 text-slate-400 mb-3" />
                <span className="text-sm font-medium text-slate-700">
                  Click to select a PDF file
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Only .pdf files are supported
                </span>
              </label>
            </div>
            {file && (
              <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              </div>
            )}
          </div>

          {file && !processedQuestions.length && !error && (
            <Button
              onClick={processFile}
              disabled={isProcessing}
              className="w-full bg-red-600 hover:bg-red-700 gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Extract Questions
            </Button>
          )}

          {processedQuestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Successfully extracted {processedQuestions.length} questions
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 p-1 border rounded-md">
                {processedQuestions.slice(0, 5).map((q, index) => (
                  <div key={index} className="p-2 bg-slate-50 rounded text-xs">
                    <strong>Q{index + 1}:</strong> {q.question}
                    {q.options.length > 0 && (
                      <div className="text-slate-600 ml-2">
                        Options: {q.options.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
                {processedQuestions.length > 5 && (
                  <div className="text-center text-xs text-slate-500 p-2">
                    ...and {processedQuestions.length - 5} more questions
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={!processedQuestions.length}
            className="bg-red-600 hover:bg-red-700"
          >
            Import {processedQuestions.length > 0 ? processedQuestions.length : ''} Questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}