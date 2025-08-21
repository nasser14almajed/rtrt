
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

export default function BulkImporter({ onImport, onClose }) {
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

      // Use a very simple schema to extract raw data
      const result = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          additionalProperties: true
        }
      });

      console.log("Raw extraction result:", result);

      if (result.status === "success" && result.output) {
        let rawData = [];
        
        // Try multiple ways to find the data array
        if (Array.isArray(result.output)) {
          rawData = result.output;
        } else if (result.output.data && Array.isArray(result.output.data)) {
          rawData = result.output.data;
        } else if (result.output.questions && Array.isArray(result.output.questions)) {
          rawData = result.output.questions;
        } else {
          // Look for any array in the result
          const keys = Object.keys(result.output);
          for (const key of keys) {
            if (Array.isArray(result.output[key]) && result.output[key].length > 0) {
              rawData = result.output[key];
              break;
            }
          }
        }

        console.log("Found raw data:", rawData);

        if (!Array.isArray(rawData) || rawData.length === 0) {
          throw new Error("No data found in the file. Make sure your CSV has at least one row of data with headers.");
        }

        const processed = rawData.map((row, index) => {
          // Smart mapping of different column name variations
          const getFieldValue = (row, fieldVariations) => {
            for (const variation of fieldVariations) {
              const keys = Object.keys(row);
              const matchingKey = keys.find(key => 
                key.toLowerCase().trim() === variation.toLowerCase() ||
                key.toLowerCase().replace(/[_\s-]/g, '') === variation.toLowerCase().replace(/[_\s-]/g, '')
              );
              if (matchingKey && row[matchingKey]) {
                return String(row[matchingKey]).trim();
              }
            }
            return null;
          };

          // Extract question
          const question = getFieldValue(row, [
            'question', 'q', 'text', 'prompt', 'query', 'ask'
          ]);

          // Extract options
          const optionA = getFieldValue(row, ['option_a', 'optiona', 'option1', 'choice1', 'a', 'answer_a']);
          const optionB = getFieldValue(row, ['option_b', 'optionb', 'option2', 'choice2', 'b', 'answer_b']);
          const optionC = getFieldValue(row, ['option_c', 'optionc', 'option3', 'choice3', 'c', 'answer_c']);
          const optionD = getFieldValue(row, ['option_d', 'optiond', 'option4', 'choice4', 'd', 'answer_d']);

          const options = [optionA, optionB, optionC, optionD].filter(opt => opt && opt.length > 0);

          // Extract correct answer
          const correctAnswerRaw = getFieldValue(row, [
            'correct_answer', 'correctanswer', 'correct', 'answer', 'solution', 'right_answer'
          ]);

          let correctAnswers = [];
          if (correctAnswerRaw) {
            // Handle letter answers (A, B, C, D)
            if (['A', 'B', 'C', 'D'].includes(correctAnswerRaw.toUpperCase())) {
              const index = correctAnswerRaw.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
              if (index < options.length) {
                correctAnswers = [options[index]];
              }
            }
            // Handle number answers (1, 2, 3, 4)
            else if (['1', '2', '3', '4'].includes(correctAnswerRaw)) {
              const index = parseInt(correctAnswerRaw) - 1;
              if (index >= 0 && index < options.length) {
                correctAnswers = [options[index]];
              }
            }
            // Handle direct text answer
            else {
              correctAnswers = [correctAnswerRaw];
            }
          }

          // Determine question type
          let questionType = getFieldValue(row, ['type', 'question_type', 'qtype', 'kind']) || "multiple_choice";
          
          // Auto-detect type if not specified
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

          // Extract other fields
          const explanation = getFieldValue(row, ['explanation', 'explain', 'reason', 'details', 'rationale']) || "";
          const pointsRaw = getFieldValue(row, ['points', 'score', 'value', 'weight', 'marks']);
          const points = pointsRaw ? (parseInt(pointsRaw) || 1) : 1;

          console.log(`Processing row ${index + 1}:`, {
            question,
            questionType,
            options,
            correctAnswers,
            points
          });

          return {
            id: Date.now().toString() + Math.random() + index,
            question: question || `Question ${index + 1}`, // Fallback for display, actual filtering relies on this being the only fallback
            type: questionType,
            options,
            correct_answers: correctAnswers,
            explanation,
            points,
            required: true
          };
        });

        // Only filter out questions that are completely empty or invalid (i.e., only contain the generated placeholder)
        const validQuestions = processed.filter(q => {
          // Check if the question is the default placeholder, meaning no actual question was extracted
          const isPlaceholder = q.question === `Question ${processed.indexOf(q) + 1}`;
          // A question is valid if it has content AND is not just the placeholder
          const hasValidQuestion = q.question && q.question.trim().length > 0 && !isPlaceholder;
          console.log(`Question "${q.question}" (isPlaceholder: ${isPlaceholder}) is valid:`, hasValidQuestion);
          return hasValidQuestion;
        });
        
        console.log(`Found ${validQuestions.length} valid questions out of ${processed.length} total`);
        
        if (validQuestions.length === 0) {
          throw new Error("No valid questions found. Please ensure your CSV has a column with questions.");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Import Questions from File
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Supported File Format: CSV</AlertTitle>
            <AlertDescription>
              <p className="mb-2">Please upload a CSV (.csv) file. The system will automatically detect your column format.</p>
              <div className="mt-3 space-y-2 text-sm">
                <p><strong>Required:</strong> A column with questions (can be named: question, q, text, prompt, etc.)</p>
                <p><strong>Optional columns we recognize:</strong></p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li><strong>Options:</strong> option_a/optionA/choice1/A, option_b/optionB/choice2/B, etc.</li>
                  <li><strong>Correct Answer:</strong> correct_answer/answer/solution (use "A"/"B" or direct text)</li>
                  <li><strong>Other:</strong> explanation/reason, points/score, type/question_type</li>
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
            <Label htmlFor="file-upload">Select File</Label>
            <div className="mt-2 border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <FileText className="w-12 h-12 text-slate-400 mb-3" />
                <span className="text-sm font-medium text-slate-700">
                  Click to select a CSV file
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  Only .csv files are supported
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Process File
            </Button>
          )}

          {processedQuestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Successfully processed {processedQuestions.length} questions
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
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Import {processedQuestions.length > 0 ? processedQuestions.length : ''} Questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
