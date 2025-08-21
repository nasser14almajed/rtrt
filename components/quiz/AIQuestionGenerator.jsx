
import React, { useState } from "react";
import { InvokeLLM } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";

export default function AIQuestionGenerator({ onGenerate, onClose }) {
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [questionType, setQuestionType] = useState("multiple_choice");
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState("medium");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateQuestions = async () => {
    if (!topic.trim()) return;
    
    setIsGenerating(true);
    try {
      const prompt = `Generate ${questionCount} ${difficulty} difficulty ${questionType.replace('_', ' ')} questions about "${topic}".
      
      ${context ? `Additional context: ${context}` : ''}
      
      For multiple choice questions, provide exactly 4 options with one correct answer.
      For checkbox questions, provide 4-6 options with multiple correct answers.
      For true/false questions, create clear statements and use "True" and "False" as options.
      For text questions, create open-ended questions.
      For fill in the blank, create sentences with blanks to fill.
      
      Include explanations for answers when applicable.
      Make questions engaging and educational.
      
      IMPORTANT: Ensure every answer option is a clear, specific text string.`;

      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  type: { type: "string" },
                  options: { 
                    type: "array", 
                    items: { type: "string" }
                  },
                  correct_answers: { 
                    type: "array", 
                    items: { type: "string" }
                  },
                  explanation: { type: "string" },
                  points: { type: "number" }
                },
                required: ["question"] // Ensure 'question' field is always present
              }
            }
          },
          required: ["questions"] // Ensure the 'questions' array is always present
        }
      });

      // Check if response and questions array are valid according to the schema
      if (response && response.questions && Array.isArray(response.questions)) {
        const questions = response.questions.map(q => {
          let processedQuestion = {
            id: Date.now().toString() + Math.random(),
            question: q.question || `Question about ${topic}`, // Fallback for question text
            type: questionType, // Use the selected question type from the UI
            options: [], // Initialize options as an empty array
            correct_answers: [], // Initialize correct_answers as an empty array
            explanation: q.explanation || "", // Fallback for explanation
            points: q.points || 1, // Fallback for points
            required: true // Mark as required
          };

          // Process based on question type to ensure valid structure
          if (questionType === 'multiple_choice') {
            // Ensure 4 options for multiple choice
            processedQuestion.options = Array.isArray(q.options) && q.options.length >= 2 
              ? q.options.slice(0, 4) // Take up to 4 options provided by AI
              : ["Option A", "Option B", "Option C", "Option D"]; // Default 4 options if AI doesn't provide enough
            
            // Ensure exactly one correct answer for multiple choice
            processedQuestion.correct_answers = Array.isArray(q.correct_answers) && q.correct_answers.length > 0
              ? [q.correct_answers[0]] // Take the first correct answer provided by AI
              : [processedQuestion.options[0]]; // Fallback to the first option as correct
          } 
          else if (questionType === 'checkbox') {
            // Allow more than 4 options for checkboxes, ensure at least 2 are from AI or use defaults
            processedQuestion.options = Array.isArray(q.options) && q.options.length >= 2 
              ? q.options 
              : ["Option A", "Option B", "Option C", "Option D"]; // Default if AI doesn't provide enough
            
            // Allow multiple correct answers, ensure at least one
            processedQuestion.correct_answers = Array.isArray(q.correct_answers) && q.correct_answers.length > 0
              ? q.correct_answers
              : [processedQuestion.options[0]]; // Fallback to the first option as correct
          } 
          else if (questionType === 'true_false') {
            // Force specific options for True/False
            processedQuestion.options = ["True", "False"];
            
            // Determine correct answer based on AI's first correct answer, default to "True"
            processedQuestion.correct_answers = Array.isArray(q.correct_answers) && q.correct_answers.length > 0
              ? [q.correct_answers[0]]
              : ["True"]; // Default to True
          } 
          else if (questionType === 'text' || questionType === 'fill_blank') {
            // Text and Fill in the Blank questions don't have multiple choice options
            processedQuestion.options = [];
            processedQuestion.correct_answers = Array.isArray(q.correct_answers) 
              ? q.correct_answers 
              : []; // Can be empty or contain suggested answers
          }

          return processedQuestion;
        });

        console.log("Generated questions:", questions);
        onGenerate(questions);
        onClose();
      } else {
        console.error("AI response did not contain a valid 'questions' array or was malformed:", response);
        alert("The AI failed to generate questions in the expected format. Please try rephrasing your topic or try again later.");
      }

    } catch (error) {
      console.error("Error generating questions:", error);
      alert("An error occurred while generating questions. Please try again with a simpler topic or fewer questions.");
    }
    setIsGenerating(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Question Generator
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="topic">Topic or Subject</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. JavaScript, World History, Marketing..."
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="context">Additional Context (Optional)</Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Provide more details about what you want to focus on..."
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="question-type">Question Type</Label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="checkbox">Checkboxes</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                  <SelectItem value="text">Text Answer</SelectItem>
                  <SelectItem value="fill_blank">Fill in Blank</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="count">Number of Questions</Label>
            <Select value={questionCount.toString()} onValueChange={(v) => setQuestionCount(parseInt(v))}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
                <SelectContent>
                  {[3, 5, 10, 15, 20].map(num => (
                    <SelectItem key={num} value={num.toString()}>{num} questions</SelectItem>
                  ))}
                </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={generateQuestions} 
            disabled={!topic.trim() || isGenerating}
            className="bg-purple-600 hover:bg-purple-700 gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Generate Questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
