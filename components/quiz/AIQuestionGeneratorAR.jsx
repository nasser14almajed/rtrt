
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

export default function AIQuestionGeneratorAR({ onGenerate, onClose }) {
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
      const prompt = `قم بإنشاء ${questionCount} أسئلة باللغة العربية بمستوى صعوبة ${difficulty === 'easy' ? 'سهل' : difficulty === 'medium' ? 'متوسط' : 'صعب'} من نوع ${questionType.replace('_', ' ')} حول موضوع "${topic}".
      
      ${context ? `سياق إضافي: ${context}` : ''}
      
      للأسئلة متعددة الخيارات، قدم 4 خيارات مع إجابة واحدة صحيحة.
      لأسئلة صناديق الاختيار، قدم 4-6 خيارات مع إجابات متعددة صحيحة.
      لأسئلة صح/خطأ، أنشئ عبارات واضحة واستخدم "صح" و "خطأ" كخيارات.
      للأسئلة النصية، أنشئ أسئلة مفتوحة.
      للأسئلة أكمل الفراغ، أنشئ جمل بفراغات للملء.
      
      قم بتضمين شروحات للإجابات عند الاقتضاء.
      اجعل الأسئلة جذابة وتعليمية.
      
      يجب أن تكون جميع الأسئلة والخيارات والشروحات باللغة العربية.`;

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
                required: ["question"]
              }
            }
          },
          required: ["questions"]
        }
      });

      if (response && response.questions && Array.isArray(response.questions)) {
        const questions = response.questions.map(q => {
          let processedQuestion = {
            id: Date.now().toString() + Math.random(),
            question: q.question || `سؤال حول ${topic}`,
            type: questionType,
            options: [],
            correct_answers: [],
            explanation: q.explanation || "",
            points: q.points || 1,
            required: true
          };

          // Process based on question type
          if (questionType === 'multiple_choice') {
            processedQuestion.options = Array.isArray(q.options) && q.options.length >= 2 
              ? q.options.slice(0, 4) 
              : ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"];
            
            processedQuestion.correct_answers = Array.isArray(q.correct_answers) && q.correct_answers.length > 0
              ? [q.correct_answers[0]]
              : [processedQuestion.options[0]];
          } 
          else if (questionType === 'checkbox') {
            processedQuestion.options = Array.isArray(q.options) && q.options.length >= 2 
              ? q.options 
              : ["الخيار أ", "الخيار ب", "الخيار ج", "الخيار د"];
            
            processedQuestion.correct_answers = Array.isArray(q.correct_answers) && q.correct_answers.length > 0
              ? q.correct_answers
              : [processedQuestion.options[0]];
          } 
          else if (questionType === 'true_false') {
            processedQuestion.options = ["صح", "خطأ"];
            processedQuestion.correct_answers = Array.isArray(q.correct_answers) && q.correct_answers.length > 0
              ? [q.correct_answers[0]]
              : ["صح"];
          } 
          else if (questionType === 'text' || questionType === 'fill_blank') {
            processedQuestion.options = [];
            processedQuestion.correct_answers = Array.isArray(q.correct_answers) 
              ? q.correct_answers 
              : [];
          }

          return processedQuestion;
        });

        console.log("Generated questions:", questions);
        onGenerate(questions);
        onClose();
      } else {
        console.error("AI response did not contain a valid 'questions' array:", response);
        alert("فشل الذكاء الاصطناعي في توليد الأسئلة بالتنسيق المتوقع. يرجى محاولة إعادة صياغة موضوعك أو المحاولة مرة أخرى لاحقًا.");
      }

    } catch (error) {
      console.error("Error generating questions:", error);
      alert("خطأ في توليد الأسئلة. يرجى المحاولة مرة أخرى بموضوع أبسط أو عدد أقل من الأسئلة.");
    }
    setIsGenerating(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            مولد الأسئلة بالذكاء الاصطناعي
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="topic">الموضوع أو المادة</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="مثال: الرياضيات، التاريخ، التسويق..."
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="context">سياق إضافي (اختياري)</Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="قدم تفاصيل أكثر حول ما تريد التركيز عليه..."
              className="mt-2"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="question-type">نوع السؤال</Label>
              <Select value={questionType} onValueChange={setQuestionType}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple_choice">اختيار متعدد</SelectItem>
                  <SelectItem value="checkbox">صناديق اختيار</SelectItem>
                  <SelectItem value="true_false">صح/خطأ</SelectItem>
                  <SelectItem value="text">إجابة نصية</SelectItem>
                  <SelectItem value="fill_blank">أكمل الفراغ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="difficulty">مستوى الصعوبة</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">سهل</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="hard">صعب</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="count">عدد الأسئلة</Label>
            <Select value={questionCount.toString()} onValueChange={(v) => setQuestionCount(parseInt(v))}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
                <SelectContent>
                {[3, 5, 10, 15, 20].map(num => (
                  <SelectItem key={num} value={num.toString()}>{num} أسئلة</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إلغاء
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
            توليد الأسئلة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
