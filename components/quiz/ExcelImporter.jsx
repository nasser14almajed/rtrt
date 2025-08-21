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
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Info, Download } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ExcelImporter({ onImport, onClose }) {
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

  const downloadTemplate = () => {
    const csvContent = `question,option_a,option_b,option_c,option_d,correct_answer,explanation,points
"What is 2 + 2?","2","3","4","5","C","Simple addition",1
"What is the capital of France?","London","Paris","Berlin","Madrid","B","Paris is the capital of France",1
"Which is a programming language?","HTML","CSS","JavaScript","XML","C","JavaScript is a programming language",1`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'quiz_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          additionalProperties: true
        }
      });

      if (result.status === "success" && result.output) {
        let rawData = [];
        
        // Extract data from various possible structures
        if (Array.isArray(result.output)) {
          rawData = result.output;
        } else if (result.output.data && Array.isArray(result.output.data)) {
          rawData = result.output.data;
        } else if (result.output.questions && Array.isArray(result.output.questions)) {
          rawData = result.output.questions;
        } else {
          const keys = Object.keys(result.output);
          for (const key of keys) {
            if (Array.isArray(result.output[key]) && result.output[key].length > 0) {
              rawData = result.output[key];
              break;
            }
          }
        }

        if (!Array.isArray(rawData) || rawData.length === 0) {
          throw new Error("No data found in the file. Make sure your file has at least one row of data with headers.");
        }

        const processed = rawData.map((row, index) => {
          // Smart field mapping
          const getFieldValue = (row, fieldVariations) => {
            for (const variation of fieldVariations) {
              const keys = Object.keys(row);
              const matchingKey = keys.find(key => 
                key.toLowerCase().trim() === variation.toLowerCase() ||
                key.toLowerCase().replace(/[_\s-]/g, '') === variation.toLowerCase().replace(/[_\s-]/g, '')
              );
              if (matchingKey && row[matchingKey] !== null && row[matchingKey] !== undefined) {
                return String(row[matchingKey]).trim();
              }
            }
            return null;
          };

          const question = getFieldValue(row, [
            'question', 'q', 'text', 'prompt', 'query', 'ask', 'title'
          ]);

          const optionA = getFieldValue(row, ['option_a', 'optiona', 'option1', 'choice1', 'a', 'answer_a']);
          const optionB = getFieldValue(row, ['option_b', 'optionb', 'option2', 'choice2', 'b', 'answer_b']);
          const optionC = getFieldValue(row, ['option_c', 'optionc', 'option3', 'choice3', 'c', 'answer_c']);
          const optionD = getFieldValue(row, ['option_d', 'optiond', 'option4', 'choice4', 'd', 'answer_d']);

          const options = [optionA, optionB, optionC, optionD].filter(opt => opt && opt.length > 0);

          const correctAnswerRaw = getFieldValue(row, [
            'correct_answer', 'correctanswer', 'correct', 'answer', 'solution', 'right_answer'
          ]);

          let correctAnswers = [];
          if (correctAnswerRaw) {
            if (['A', 'B', 'C', 'D'].includes(correctAnswerRaw.toUpperCase())) {
              const index = correctAnswerRaw.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
              if (index < options.length) {
                correctAnswers = [options[index]];
              }
            } else if (['1', '2', '3', '4'].includes(correctAnswerRaw)) {
              const index = parseInt(correctAnswerRaw) - 1;
              if (index >= 0 && index < options.length) {
                correctAnswers = [options[index]];
              }
            } else {
              correctAnswers = [correctAnswerRaw];
            }
          }

          let questionType = getFieldValue(row, ['type', 'question_type', 'qtype', 'kind']) || "multiple_choice";
          
          if (!getFieldValue(row, ['type', 'question_type', 'qtype', 'kind'])) {
            if (options.length === 2 && 
                (options.some(opt => opt.toLowerCase().includes('true')) || 
                 options.some(opt => opt.toLowerCase().includes('false')))) {
              questionType = "true_false";
            } else if (options.length > 0) {
              questionType = "multiple_choice";
            } else {
              questionType = "text";
            }
          }

          const explanation = getFieldValue(row, ['explanation', 'explain', 'reason', 'details', 'rationale']) || "";
          const pointsRaw = getFieldValue(row, ['points', 'score', 'value', 'weight', 'marks']);
          const points = pointsRaw ? (parseInt(pointsRaw) || 1) : 1;

          return {
            id: Date.now().toString() + Math.random() + index,
            question: question || `Question ${index + 1}`,
            type: questionType,
            options,
            correct_answers: correctAnswers,
            explanation,
            points,
            required: true
          };
        });

        const validQuestions = processed.filter(q => {
          const hasValidQuestion = q.question && q.question.trim().length > 0 && 
                                 !q.question.startsWith('Question ') && q.question !== "";
          return hasValidQuestion;
        });
        
        if (validQuestions.length === 0) {
          throw new Error("No valid questions found. Please ensure your file has a column with questions.");
        }

        setProcessedQuestions(validQuestions);
      } else {
        throw new Error(result.details || "Could not extract data from file. Please check the file format.");
      }
    } catch (err) {
      console.error("Error processing file:", err);
      setError(err.message || "Could not process the file. Please check your file format and try again.");
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
            <Upload className="w-5 h-5 text-indigo-600" />
            Import Questions from Excel/CSV
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Supported Formats: CSV, Excel (.xlsx)</AlertTitle>
            <AlertDescription>
              <p className="mb-3">Upload a CSV or Excel file with your questions. The system will automatically detect your column format.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="font-medium mb-2">Required Column:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Question:</strong> question, q, text, prompt</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium mb-2">Optional Columns:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Options:</strong> option_a, option_b, option_c, option_d</li>
                    <li><strong>Answer:</strong> correct_answer (use A/B/C/D or text)</li>
                    <li><strong>Extra:</strong> explanation, points</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <Button onClick={downloadTemplate} variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Download Template
                </Button>
                <span className="ml-2 text-sm text-blue-700">Get a sample CSV file to get started</span>
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
            <Label htmlFor="file-upload">Select File</Label>
            <div className="mt-2 border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-slate-400 transition-colors">
              <input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <span className="text-lg font-medium text-slate-700 mb-1">
                  Click to select a file
                </span>
                <span className="text-sm text-slate-500">
                  Supports CSV and Excel files (.csv, .xlsx, .xls)
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2 py-3"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing File...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Process File
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
                    Successfully processed {processedQuestions.length} questions
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
                        <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
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
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
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
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            <Upload className="w-4 h-4" />
            Import {processedQuestions.length > 0 ? processedQuestions.length : ''} Questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}